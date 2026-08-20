import { injectable } from "tsyringe";
import { SiteRepository } from "../../site/repositories/site.repository";
import { WorkspaceStrategyService } from "../../strategic-intelligence/services/workspace-strategy.service";
import { CampaignService } from "../../campaign/services/campaign.service";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { CampaignRoadmapRepository } from "../../campaign/repositories/campaign-roadmap.repository";
import { CampaignPostItemRepository } from "../../campaign/repositories/campaign-post-item.repository";
import { CampaignPlanningService } from "../../campaign/services/campaign-planning.service";
import { RealtimeService } from "../../../shared/realtime/services/realtime.service";
import { REALTIME_EVENTS } from "../../../shared/realtime/contracts/event-names";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { CampaignRoadmapStatus } from "../../../shared/constants/campaign.constant";
import { websiteUrlsEqual } from "../../orchestrator/utils/website-onboarding.helper";
import type { StrategistProgress, StrategistProgressStep, StrategistStepStatus } from "./onboarding.service";

export type SignupBootstrapStepId = StrategistProgressStep["id"];
export type SignupBootstrapStepEventStatus = "in_progress" | "ready" | "failed";

export type StrategistBootstrapStartResult = {
  progress: StrategistProgress;
  alreadyReady: boolean;
  accepted: boolean;
};

const inflight = new Map<string, Promise<void>>();
const inflightUrl = new Map<string, string>();
const runEpoch = new Map<string, number>();
const starting = new Set<string>();

export function __resetStrategistBootstrapInflightForTests(): void {
  inflight.clear();
  inflightUrl.clear();
  runEpoch.clear();
  starting.clear();
}

export function isStrategistBootstrapInflight(siteId: string): boolean {
  return inflight.has(siteId) || starting.has(siteId);
}

export function getStrategistBootstrapInflight(siteId: string): Promise<void> | undefined {
  return inflight.get(siteId);
}

@injectable()
export class StrategistBootstrapService {
  constructor(
    private siteRepository: SiteRepository,
    private workspaceStrategyService: WorkspaceStrategyService,
    private campaignService: CampaignService,
    private campaignRepository: CampaignRepository,
    private campaignRoadmapRepository: CampaignRoadmapRepository,
    private postItemRepository: CampaignPostItemRepository,
    private campaignPlanningService: CampaignPlanningService,
    private realtimeService: RealtimeService
  ) {}

  isInflight(siteId: string): boolean {
    return isStrategistBootstrapInflight(siteId);
  }

  /**
   * Start (or coalesce) the first strategy → campaign → topics run.
   * Returns immediately; work continues in-process.
   * Pass `force` after a website URL change so a new run supersedes any inflight one.
   */
  async start(
    siteId: string,
    userId: string,
    options?: { force?: boolean }
  ): Promise<StrategistBootstrapStartResult> {
    if (!env.orchestrator.strategicIntelligenceEnabled) {
      const progress = this.disabledProgress(siteId);
      this.emitCompleted(siteId, userId);
      return { progress, alreadyReady: true, accepted: false };
    }

    const site = await this.siteRepository.findById(siteId);
    const currentUrl = site?.website_url || "";
    const strategy = await this.workspaceStrategyService.peekActive(siteId).catch(() => null);
    const urlChanged = Boolean(
      currentUrl && strategy?.website_url && !websiteUrlsEqual(currentUrl, strategy.website_url)
    );
    const needsRefresh = Boolean(
      options?.force || urlChanged || strategy?.generation_status === "failed"
    );
    const alreadyStarted = inflight.has(siteId) || starting.has(siteId);
    const sameInflightUrl =
      !inflightUrl.has(siteId) || websiteUrlsEqual(inflightUrl.get(siteId), currentUrl);

    if (alreadyStarted && !needsRefresh && sameInflightUrl) {
      const current = await this.deriveProgress(siteId);
      return { progress: current, alreadyReady: current.ready, accepted: !current.ready };
    }

    if (!needsRefresh && !alreadyStarted) {
      const current = await this.deriveProgress(siteId);
      if (current.ready) {
        return { progress: current, alreadyReady: true, accepted: false };
      }
    }

    const epoch = (runEpoch.get(siteId) ?? 0) + 1;
    runEpoch.set(siteId, epoch);
    starting.add(siteId);
    try {
      const current = await this.deriveProgress(siteId);
      const run = this.run(siteId, userId, epoch).finally(() => {
        if (runEpoch.get(siteId) === epoch) {
          inflight.delete(siteId);
          inflightUrl.delete(siteId);
        }
      });
      inflight.set(siteId, run);
      inflightUrl.set(siteId, currentUrl);

      const startingProgress: StrategistProgress = {
        site_id: siteId,
        ready: false,
        failed: false,
        steps: current.steps.map((step) =>
          step.id === "content_strategy"
            ? { ...step, status: "in_progress" as const, error: undefined }
            : { ...step, status: "pending" as const, error: undefined }
        ),
      };
      return { progress: startingProgress, alreadyReady: false, accepted: true };
    } finally {
      starting.delete(siteId);
    }
  }

  /** Fire-and-forget from site create. Same pipeline as the HTTP endpoint. */
  startInBackground(siteId: string, userId: string): void {
    void this.start(siteId, userId).catch((error) => {
      logger.error(
        "Signup strategist bootstrap failed to start",
        error instanceof Error ? error : new Error(String(error)),
        { siteId, userId },
        "StrategistBootstrapService"
      );
    });
  }

  async deriveProgress(siteId: string): Promise<StrategistProgress> {
    if (!env.orchestrator.strategicIntelligenceEnabled) {
      return this.disabledProgress(siteId);
    }

    const strategy = await this.workspaceStrategyService.getActive(siteId).catch((err) => {
      logger.warn(
        "Could not load content strategy for signup progress",
        { siteId, error: err instanceof Error ? err.message : String(err) },
        "StrategistBootstrapService"
      );
      return null;
    });

    let strategyStatus: StrategistStepStatus = "pending";
    let strategyError: string | undefined;
    const strategyReady = strategy?.generation_status === "ready";
    if (!strategy) {
      strategyStatus = "pending";
    } else if (strategyReady) {
      strategyStatus = "ready";
    } else if (strategy.generation_status === "generating") {
      strategyStatus = "in_progress";
    } else if (strategy.generation_status === "failed") {
      strategyStatus = "failed";
      strategyError = strategy.generation_error || "Content strategy generation failed";
    }

    const campaign = await this.campaignRepository.findDefault(siteId).catch(() => null);
    let campaignStatus: StrategistStepStatus = campaign?._id ? "ready" : "pending";
    if (strategyStatus === "failed") {
      campaignStatus = "failed";
    } else if (strategyStatus === "in_progress" && campaignStatus !== "ready") {
      campaignStatus = "pending";
    }

    let topicsStatus: StrategistStepStatus = "pending";
    if (strategyStatus === "failed" || campaignStatus === "failed") {
      topicsStatus = "failed";
    } else if (campaignStatus !== "ready" || strategyStatus !== "ready") {
      topicsStatus = this.isInflight(siteId) && strategyStatus === "ready" ? "pending" : "pending";
    } else {
      const campaignId = campaign!._id!.toString();
      const roadmap = await this.campaignRoadmapRepository.findLatest(campaignId, siteId).catch(() => null);
      const hasTopics = Array.isArray(roadmap?.items) && roadmap.items.length > 0;
      if (
        hasTopics &&
        (roadmap?.status === CampaignRoadmapStatus.APPROVED || roadmap?.status === CampaignRoadmapStatus.PROPOSED)
      ) {
        topicsStatus = "ready";
      } else if (this.isInflight(siteId) || roadmap) {
        topicsStatus = "in_progress";
      } else {
        topicsStatus = "pending";
      }
    }

    const steps: StrategistProgressStep[] = [
      {
        id: "content_strategy",
        label: "Content strategy being generated",
        status: strategyStatus,
        error: strategyError,
      },
      { id: "default_campaign", label: "Campaign being drafted", status: campaignStatus },
      { id: "campaign_topics", label: "Campaign topics being generated", status: topicsStatus },
    ];
    const ready = steps.every((s) => s.status === "ready");
    const failed = steps.some((s) => s.status === "failed");
    return { site_id: siteId, steps, ready, failed };
  }

  private async run(siteId: string, userId: string, epoch: number): Promise<void> {
    const remaining: SignupBootstrapStepId[] = ["content_strategy", "default_campaign", "campaign_topics"];
    let currentStep: SignupBootstrapStepId = "content_strategy";
    const isStale = () => runEpoch.get(siteId) !== epoch;
    try {
      await this.clearPreviousTopics(siteId);
      if (isStale()) return;

      currentStep = "content_strategy";
      this.emitStep(siteId, userId, "content_strategy", "in_progress");
      const site = await this.siteRepository.findById(siteId);
      const websiteUrl = site?.website_url;
      const strategy = await this.workspaceStrategyService.generateFromWebsite(siteId, userId, websiteUrl, {
        skipRoadmapBootstrap: true,
      });
      if (isStale()) return;
      if (strategy.generation_status !== "ready") {
        throw new Error(strategy.generation_error || "Content strategy generation failed");
      }
      this.emitStep(siteId, userId, "content_strategy", "ready");
      remaining.shift();

      currentStep = "default_campaign";
      this.emitStep(siteId, userId, "default_campaign", "in_progress");
      const campaign = await this.campaignService.ensureDefaultCampaign(siteId, userId, {
        skipRoadmapBootstrap: true,
      });
      if (isStale()) return;
      if (!campaign?._id) {
        throw new Error("Could not create the default campaign");
      }
      this.emitStep(siteId, userId, "default_campaign", "ready");
      remaining.shift();

      currentStep = "campaign_topics";
      this.emitStep(siteId, userId, "campaign_topics", "in_progress");
      await this.campaignPlanningService.ensureDefaultRoadmap(siteId, userId);
      if (isStale()) return;
      const roadmap = await this.campaignRoadmapRepository.findLatest(campaign._id.toString(), siteId);
      const hasTopics = Array.isArray(roadmap?.items) && roadmap.items.length > 0;
      if (!hasTopics) {
        throw new Error("Campaign topics were not generated");
      }
      this.emitStep(siteId, userId, "campaign_topics", "ready");
      remaining.shift();

      if (isStale()) return;
      this.emitCompleted(siteId, userId);
      logger.info("Signup strategist bootstrap completed", { siteId, userId }, "StrategistBootstrapService");
    } catch (error) {
      if (isStale()) return;
      const message = error instanceof Error ? error.message : String(error);
      logger.warn(
        "Signup strategist bootstrap failed",
        { siteId, userId, step: currentStep, error: message },
        "StrategistBootstrapService"
      );
      await this.compensate(siteId, userId, message);
      this.emitStep(siteId, userId, currentStep, "failed", message);
      for (const step of remaining.filter((s) => s !== currentStep)) {
        this.emitStep(siteId, userId, step, "failed", message);
      }
      this.emitFailed(siteId, userId, currentStep, message);
    }
  }

  private async clearPreviousTopics(siteId: string): Promise<void> {
    const campaign = await this.campaignRepository.findDefault(siteId).catch(() => null);
    if (!campaign?._id) return;
    const campaignId = campaign._id.toString();
    const latest = await this.campaignRoadmapRepository.findLatest(campaignId, siteId).catch(() => null);
    if (latest?._id) {
      await this.campaignRoadmapRepository.deleteById(latest._id.toString(), siteId);
    }
    await this.postItemRepository.deleteByCampaign(campaignId, siteId).catch(() => undefined);
  }

  private async compensate(siteId: string, userId: string, message: string): Promise<void> {
    await this.workspaceStrategyService.markFailed(siteId, userId, message).catch((err) => {
      logger.warn(
        "Could not mark content strategy failed during signup compensate",
        { siteId, error: err instanceof Error ? err.message : String(err) },
        "StrategistBootstrapService"
      );
    });
    await this.clearPreviousTopics(siteId);
  }

  private disabledProgress(siteId: string): StrategistProgress {
    return {
      site_id: siteId,
      ready: true,
      failed: false,
      steps: [
        { id: "content_strategy", label: "Content strategy being generated", status: "ready" },
        { id: "default_campaign", label: "Campaign being drafted", status: "ready" },
        { id: "campaign_topics", label: "Campaign topics being generated", status: "ready" },
      ],
    };
  }

  private emitStep(
    siteId: string,
    userId: string,
    step: SignupBootstrapStepId,
    status: SignupBootstrapStepEventStatus,
    error?: string
  ): void {
    this.realtimeService.emitToUser(
      userId,
      REALTIME_EVENTS.SIGNUP_BOOTSTRAP_STEP,
      { siteId, step, status, error },
      { siteId }
    );
  }

  private emitCompleted(siteId: string, userId: string): void {
    this.realtimeService.emitToUser(userId, REALTIME_EVENTS.SIGNUP_BOOTSTRAP_COMPLETED, { siteId }, { siteId });
  }

  private emitFailed(siteId: string, userId: string, step: SignupBootstrapStepId, error: string): void {
    this.realtimeService.emitToUser(
      userId,
      REALTIME_EVENTS.SIGNUP_BOOTSTRAP_FAILED,
      { siteId, step, error },
      { siteId }
    );
  }
}

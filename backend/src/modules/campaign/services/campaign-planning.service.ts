import { injectable } from "tsyringe";
import { CampaignRepository } from "../repositories/campaign.repository";
import { CampaignRoadmapRepository } from "../repositories/campaign-roadmap.repository";
import { CampaignMemoryRepository } from "../repositories/campaign-memory.repository";
import { CampaignEventRepository } from "../repositories/campaign-event.repository";
import { OrchestratorApprovalRepository } from "../../orchestrator/repositories/orchestrator-approval.repository";
import { OrchestratorApprovalKind } from "../../../shared/schemas/orchestrator-approval.schema";
import { ResearchGraphService } from "../../orchestratorv2/research/research-graph.service";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import {
  CampaignLifecycleStatus,
  CampaignRoadmapStatus,
  CampaignEventType,
  PostFrequency,
  MAX_CAMPAIGN_PLANNED_POSTS,
  SIGNUP_DEFAULT_ROADMAP_TOPICS,
} from "../../../shared/constants/campaign.constant";
import type { CampaignRoadmapItemSnapshot, RoadmapPostType } from "../../../shared/schemas/campaign-roadmap.schema";
import type { Campaign } from "../../../shared/schemas/campaign.schema";
import type { CampaignTopicSuggestion } from "../../orchestratorv2/research/research.types";
import { WorkspaceStrategyService } from "../../strategic-intelligence/services/workspace-strategy.service";
import {
  formatContentStrategyForPrompt,
  isContentStrategyReady,
  parseContentStrategyDocument,
  type ContentStrategyDocument,
} from "../../../shared/types/content-strategy.document";
import { CampaignRoadmapService } from "./campaign-roadmap.service";

const defaultRoadmapInflight = new Map<string, Promise<void>>();

export type PlanCampaignOptions = {
  threadId?: string;
  autoApprove?: boolean;
  maxTopics?: number;
  skipResearch?: boolean;
  /** Signup: approve topics without creating auto-generate scheduled posts. */
  skipMaterialize?: boolean;
};

@injectable()
export class CampaignPlanningService {
  constructor(
    private campaignRepository: CampaignRepository,
    private roadmapRepository: CampaignRoadmapRepository,
    private memoryRepository: CampaignMemoryRepository,
    private eventRepository: CampaignEventRepository,
    private approvalRepository: OrchestratorApprovalRepository,
    private researchGraph: ResearchGraphService,
    private workspaceStrategy: WorkspaceStrategyService,
    private roadmapService: CampaignRoadmapService
  ) {}

  /**
   * Build a strategic roadmap from campaign fields (deterministic V1; LLM layer optional later).
   */
  async planCampaign(campaignId: string, siteId: string, userId: string, options?: PlanCampaignOptions) {
    const campaign = await this.campaignRepository.findById(campaignId, siteId);
    if (!campaign) {
      throw new NotFoundError("Campaign not found");
    }

    const contentStrategy = await this.workspaceStrategy.requireReady(siteId);
    const strategyBlock = formatContentStrategyForPrompt(contentStrategy.document);

    await this.memoryRepository.ensureForCampaign(campaignId, siteId);
    const topicCap = options?.maxTopics ?? (campaign.is_default ? 12 : MAX_CAMPAIGN_PLANNED_POSTS);
    const estimated = campaign.is_default
      ? Math.min(campaign.total_posts_planned ?? SIGNUP_DEFAULT_ROADMAP_TOPICS, topicCap)
      : (campaign.total_posts_planned ?? this.estimatePostCount(campaign));
    const total = Math.min(Math.max(1, estimated), topicCap, MAX_CAMPAIGN_PLANNED_POSTS);
    let topics = this.seedTopics(campaign, contentStrategy.document, total);
    let researchPackageId: string | undefined;
    if (!options?.skipResearch) {
      try {
        const researched = await this.researchGraph.suggestCampaignTopics({
          workspace_id: siteId,
          question: [
            `Content topics for campaign "${campaign.name}"`,
            `Goal: ${campaign.goal}`,
            campaign.target_audience ? `Audience: ${campaign.target_audience}` : "",
            strategyBlock,
          ]
            .filter(Boolean)
            .join(". "),
          count: total,
          campaign_goal: campaign.goal,
          created_by: userId,
          thread_id: options?.threadId,
          signal: AbortSignal.timeout(90_000),
        });
        if (researched.topics.length) {
          topics = researched.topics;
          researchPackageId = researched.package_id;
        }
      } catch (error) {
        logger.warn(
          "Campaign roadmap research failed; using existing topics",
          { campaignId, error: String(error) },
          "CampaignPlanningService"
        );
      }
    }

    const slots = this.distributeScheduleDates(
      campaign.start_date,
      campaign.end_date,
      total,
      campaign.posting_frequency
    );

    const items: CampaignRoadmapItemSnapshot[] = slots.map((scheduled_at, idx) => {
      const topic = topics[idx % topics.length];
      const uniqueEnough = topics.length >= Math.min(total, topics.length) && topics.length > 1;
      const title = uniqueEnough && idx < topics.length ? topic.title : `${topic.title} — Part ${idx + 1}`;
      return {
        title,
        about: topic.about,
        keywords: topic.keywords ?? [],
        post_type: topic.post_type,
        campaign_support: topic.campaign_support,
        objective: topic.about || `Support campaign goal: ${campaign.goal}`,
        strategic_intent: `Advance ${campaign.campaign_type ?? "custom"} narrative for ${campaign.target_audience ?? "target audience"}.`,
        sequence_index: idx,
        narrative_phase: idx === 0 ? "awareness" : idx < slots.length - 1 ? "consideration" : "conversion",
        scheduled_at,
      };
    });

    const version = await this.roadmapRepository.nextVersion(campaignId, siteId);
    const roadmap = await this.roadmapRepository.create({
      campaign_id: campaignId,
      site_id: siteId,
      version,
      status: CampaignRoadmapStatus.PROPOSED,
      generated_by: "ai",
      summary: `Roadmap with ${items.length} posts aligned to: ${campaign.goal}`,
      narrative_arc: `Progressive content arc from awareness through conversion over ${slots.length} publish slots.`,
      cadence_rationale: `Posts spaced using ${campaign.posting_frequency} cadence between ${campaign.start_date.toISOString().slice(0, 10)} and ${campaign.end_date.toISOString().slice(0, 10)}.`,
      items,
      diversity_notes: `Topics rotated across: ${topics.map((topic) => topic.title).join(", ")}.`,
      gap_analysis: "Review locked slots and adjust titles before approval.",
      research_package_id: researchPackageId,
    });

    await this.campaignRepository.update(campaignId, siteId, {
      lifecycle_status: options?.autoApprove
        ? CampaignLifecycleStatus.ACTIVE
        : CampaignLifecycleStatus.AWAITING_APPROVAL,
      total_posts_planned: items.length,
    });

    await this.eventRepository.append({
      campaign_id: campaignId,
      site_id: siteId,
      type: CampaignEventType.ROADMAP_PROPOSED,
      actor_user_id: userId,
      payload: { version, item_count: items.length },
    });

    if (options?.autoApprove) {
      await this.roadmapService.approveRoadmap(campaignId, siteId, userId, {
        skipMaterialize: options.skipMaterialize,
      });
      logger.info("Campaign roadmap auto-approved", { campaignId, version }, "CampaignPlanningService");
      const approved = await this.roadmapRepository.findLatest(campaignId, siteId);
      return approved ?? roadmap;
    }

    await this.approvalRepository.create({
      site_id: siteId,
      thread_id: options?.threadId,
      requested_for_user_id: userId,
      requested_by_user_id: userId,
      kind: OrchestratorApprovalKind.CAMPAIGN_ROADMAP_APPROVAL,
      action: "campaign.approveRoadmap",
      summary: `Approve roadmap v${version} (${items.length} posts) for "${campaign.name}".`,
      payload: {
        campaign_id: campaignId,
        roadmap_id: roadmap._id!.toString(),
        version,
      },
    });

    logger.info("Campaign roadmap proposed", { campaignId, version }, "CampaignPlanningService");
    return roadmap;
  }

  /**
   * After Content Strategy is ready, generate and auto-approve Evergreen's first roadmap
   * so weekly writing has topics without a Generate/Approve click.
   * Signup uses 4 strategy-seeded topics (no web-research graph) so setup cannot hang.
   */
  async ensureDefaultRoadmap(siteId: string, userId: string): Promise<void> {
    const inflight = defaultRoadmapInflight.get(siteId);
    if (inflight) return inflight;

    const run = this.runEnsureDefaultRoadmap(siteId, userId).finally(() => {
      defaultRoadmapInflight.delete(siteId);
    });
    defaultRoadmapInflight.set(siteId, run);
    return run;
  }

  private async runEnsureDefaultRoadmap(siteId: string, userId: string): Promise<void> {
    const campaign = await this.campaignRepository.findDefault(siteId);
    if (!campaign?._id) return;

    const campaignId = campaign._id.toString();
    const existing = await this.roadmapRepository.findLatest(campaignId, siteId);
    if (existing) return;

    const strategy = await this.workspaceStrategy.getActive(siteId);
    if (!strategy || !isContentStrategyReady(strategy.generation_status, strategy.document)) {
      return;
    }

    try {
      await this.planCampaign(campaignId, siteId, userId, {
        autoApprove: true,
        maxTopics: SIGNUP_DEFAULT_ROADMAP_TOPICS,
        skipResearch: true,
        skipMaterialize: true,
      });
    } catch (err) {
      logger.warn(
        "Evergreen roadmap auto-generate failed",
        { siteId, campaignId, error: err instanceof Error ? err.message : String(err) },
        "CampaignPlanningService"
      );
      throw err;
    }
  }

  private seedTopics(
    campaign: Campaign,
    document: ContentStrategyDocument | undefined,
    count: number
  ): CampaignTopicSuggestion[] {
    const parsed = parseContentStrategyDocument(document);
    const seen = new Set<string>();
    const titles: string[] = [];
    const push = (raw?: string) => {
      const title = raw?.trim();
      if (!title) return;
      const key = title.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      titles.push(title.slice(0, 120));
    };

    for (const title of campaign.primary_topics ?? []) push(title);
    for (const title of campaign.ai_strategy?.content_themes ?? []) push(title);
    for (const pillar of parsed.content_franchise.pillars) push(pillar.name);
    for (const cluster of parsed.discovery?.topic_clusters ?? []) push(cluster);
    for (const message of parsed.narrative.supporting_messages) push(message);
    push(parsed.narrative.core_message);
    push(parsed.north_star.what_we_are);
    if (!titles.length) push(campaign.goal.slice(0, 80));

    const seed = titles[0] ?? campaign.goal.slice(0, 80);
    while (titles.length < count) {
      titles.push(`${seed} — Part ${titles.length + 1}`);
    }

    return titles.slice(0, count).map((title) => this.topicFromTitle(title, campaign.goal));
  }

  private topicFromTitle(title: string, campaignGoal: string): CampaignTopicSuggestion {
    return {
      title,
      about: `A post that supports the campaign goal: ${campaignGoal}`,
      keywords: [],
      post_type: "article" as RoadmapPostType,
      campaign_support: `Supports the campaign goal: ${campaignGoal}`,
    };
  }

  private estimatePostCount(campaign: { start_date: Date; end_date: Date; posting_frequency: PostFrequency }) {
    const days = Math.max(7, Math.ceil((campaign.end_date.getTime() - campaign.start_date.getTime()) / 86400000));
    switch (campaign.posting_frequency) {
      case PostFrequency.DAILY:
        return Math.min(days, 30);
      case PostFrequency.WEEKLY:
        return Math.max(4, Math.ceil(days / 7));
      case PostFrequency.BIWEEKLY:
        return Math.max(2, Math.ceil(days / 14));
      case PostFrequency.MONTHLY:
        return Math.max(2, Math.ceil(days / 30));
      default:
        return 8;
    }
  }

  private distributeScheduleDates(start: Date, end: Date, count: number, frequency: PostFrequency): Date[] {
    if (count <= 0) {
      throw new BadRequestError("Campaign must plan at least one post");
    }
    const span = end.getTime() - start.getTime();
    const step =
      frequency === PostFrequency.DAILY
        ? 86400000
        : frequency === PostFrequency.WEEKLY
          ? 7 * 86400000
          : frequency === PostFrequency.BIWEEKLY
            ? 14 * 86400000
            : span / Math.max(1, count - 1);

    const dates: Date[] = [];
    for (let i = 0; i < count; i++) {
      const t = Math.min(start.getTime() + i * step, end.getTime());
      dates.push(new Date(t));
    }
    return dates;
  }
}

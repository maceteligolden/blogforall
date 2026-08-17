import { injectable, container } from "tsyringe";
import { randomUUID } from "crypto";
import {
  WorkspaceStrategyRepository,
  type WorkspaceStrategy,
  type WorkspaceStrategySource,
} from "../repositories/workspace-strategy.repository";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import { ContentStrategyGenerateService } from "./content-strategy-generate.service";
import { SiteRepository } from "../../site/repositories/site.repository";
import { REALTIME_EVENTS } from "../../../shared/realtime/contracts/event-names";
import { BadRequestError, NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import {
  averageSectionConfidence,
  documentFromStrategicMemory,
  documentHasSubstance,
  emptyContentStrategyDocument,
  flattenContentStrategy,
  isContentStrategyReady,
  mergeContentStrategyDocument,
  parseContentStrategyDocument,
  type ContentStrategyDocument,
  type ContentStrategyGenerationStatus,
} from "../../../shared/types/content-strategy.document";

export type UpdateWorkspaceStrategyInput = {
  purpose?: string;
  long_term_outcomes?: string[];
  principles?: string[];
  audience_summary?: string;
  perception_goals?: string[];
  constraints?: string[];
  document?: Partial<ContentStrategyDocument>;
  website_url?: string;
};

@injectable()
export class WorkspaceStrategyService {
  constructor(
    private readonly strategies: WorkspaceStrategyRepository,
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly knowledge: BusinessKnowledgeService,
    private readonly generateService: ContentStrategyGenerateService,
    private readonly siteRepository: SiteRepository
  ) {}

  async getActive(siteId: string): Promise<WorkspaceStrategy | null> {
    const existing = await this.strategies.findActive(siteId);
    if (!existing) return null;
    if (documentHasSubstance(existing.document)) return this.hydrate(existing);

    const memory = await this.memoryRepository.findBySiteId(siteId).catch(() => null);
    const fromMemory = documentFromStrategicMemory(memory?.strategic);
    const fromLegacy = this.documentFromLegacy(existing);
    const document = documentHasSubstance(fromMemory) ? fromMemory : fromLegacy;
    if (!documentHasSubstance(document)) return this.hydrate(existing);

    const flat = flattenContentStrategy(document);
    const updated = await this.strategies.updateActive(siteId, {
      document,
      ...flat,
      generation_status: "ready",
      generated_from: existing.generated_from === "stub" ? "onboarding" : existing.generated_from,
    });
    return this.hydrate(updated);
  }

  async getActiveOrThrow(siteId: string): Promise<WorkspaceStrategy> {
    const s = await this.getActive(siteId);
    if (!s) throw new NotFoundError("Content strategy not found");
    return s;
  }

  async requireReady(siteId: string): Promise<WorkspaceStrategy> {
    const strategy = await this.getActive(siteId);
    if (!strategy || !isContentStrategyReady(strategy.generation_status, strategy.document)) {
      throw new BadRequestError(
        "Content Strategy must be ready before you can create or plan a campaign. Add a website URL or fill it in on the Content Strategy page."
      );
    }
    return strategy;
  }

  async listVersions(siteId: string) {
    return this.strategies.listVersions(siteId);
  }

  /**
   * Ensure an active strategy exists. Never blocks content for thin stubs.
   */
  async ensureStrategy(siteId: string, userId: string): Promise<WorkspaceStrategy> {
    const existing = await this.getActive(siteId);
    if (existing) return existing;
    return this.createStub(siteId, userId, { generation_status: "failed", source: "stub" });
  }

  async createGeneratingStub(siteId: string, userId: string, websiteUrl?: string): Promise<WorkspaceStrategy> {
    const existing = await this.strategies.findActive(siteId);
    if (existing) {
      const updated = await this.strategies.updateActive(
        siteId,
        {
          generation_status: "generating",
          website_url: websiteUrl || existing.website_url,
          generation_error: "",
          generated_from: websiteUrl ? "website" : existing.generated_from,
        },
        userId
      );
      this.emitStatus(siteId, userId, "generating");
      return this.hydrate(updated);
    }
    const stub = await this.createStub(siteId, userId, {
      generation_status: "generating",
      websiteUrl,
      source: websiteUrl ? "website" : "stub",
    });
    this.emitStatus(siteId, userId, "generating");
    return stub;
  }

  startBackgroundGenerate(siteId: string, userId: string, websiteUrl?: string): void {
    void this.generateFromWebsite(siteId, userId, websiteUrl).catch((error) => {
      logger.error(
        "Background content strategy generation failed",
        error instanceof Error ? error : new Error(String(error)),
        { siteId },
        "WorkspaceStrategyService"
      );
    });
  }

  async generateFromWebsite(siteId: string, userId: string, websiteUrl?: string): Promise<WorkspaceStrategy> {
    const site = await this.siteRepository.findById(siteId);
    const url = websiteUrl || site?.website_url;
    await this.createGeneratingStub(siteId, userId, url);
    if (!url) {
      return this.markFailed(siteId, userId, "Add a website URL to generate Content Strategy.");
    }

    try {
      const ingested = await this.generateService.ingestWebsiteAndSeedMemory(siteId, userId, url);
      if (site && !site.website_url) {
        await this.siteRepository.update(siteId, { website_url: ingested.url });
      }
      const mapped = await this.generateService.mapScrapeToDocument({
        scrapeText: ingested.scrapeText,
        proposalSummary: ingested.proposalSummary,
        websiteUrl: ingested.url,
        workspaceName: site?.name,
        strategic: ingested.strategic,
      });
      const flat = flattenContentStrategy(mapped.document);
      const created = await this.strategies.updateActive(
        siteId,
        {
          generation_status: "ready",
          version: await this.strategies.nextVersion(siteId),
          website_url: ingested.url,
          document: mapped.document,
          section_confidence: mapped.section_confidence,
          generated_at: new Date(),
          generation_error: "",
          ...flat,
          generated_from: "website",
          confidence_summary: averageSectionConfidence(mapped.section_confidence),
        },
        userId
      );
      this.emitStatus(siteId, userId, "ready");
      await this.notify(userId, siteId, true);
      this.bootstrapDefaultRoadmap(siteId, userId);
      logger.info(
        "Content Strategy generated from website",
        { siteId, version: created.version, id: created._id ?? randomUUID() },
        "WorkspaceStrategyService"
      );
      return this.hydrate(created);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn("Content Strategy generation failed", { siteId, error: message }, "WorkspaceStrategyService");
      return this.markFailed(siteId, userId, message);
    }
  }

  async generate(
    siteId: string,
    userId: string,
    opts?: { force?: boolean; source?: WorkspaceStrategySource }
  ): Promise<WorkspaceStrategy> {
    const site = await this.siteRepository.findById(siteId);
    if (site?.website_url) {
      return this.generateFromWebsite(siteId, userId, site.website_url);
    }

    const memory = await this.memoryRepository.ensureForSite(siteId, userId);
    await this.knowledge.seedFromWorkspaceMemory(siteId, userId);
    const document = documentFromStrategicMemory(memory.strategic);
    const thin = !documentHasSubstance(document);
    const source: WorkspaceStrategySource = opts?.source ?? (thin ? "stub" : "onboarding");
    const flat = flattenContentStrategy(document);

    if (opts?.force !== false) {
      await this.strategies.archiveActive(siteId);
    } else {
      const again = await this.strategies.findActive(siteId);
      if (again) return this.hydrate(again);
    }

    const created = await this.strategies.create({
      site_id: siteId,
      status: "active",
      generation_status: thin ? "failed" : "ready",
      version: await this.strategies.nextVersion(siteId),
      website_url: site?.website_url,
      document,
      section_confidence: {
        north_star: { confidence: thin ? 0.3 : 0.55, source: "inferred" },
        audience: { confidence: thin ? 0.3 : 0.55, source: "user" },
      },
      generated_at: thin ? undefined : new Date(),
      generation_error: thin ? "Add a website URL or fill the Content Strategy editor." : "",
      ...flat,
      generated_from: source,
      confidence_summary: thin ? 0.35 : 0.55,
      updated_by: userId,
    });
    const hydrated = this.hydrate(created);
    if (!thin) this.bootstrapDefaultRoadmap(siteId, userId);
    return hydrated;
  }

  async update(siteId: string, userId: string, input: UpdateWorkspaceStrategyInput): Promise<WorkspaceStrategy> {
    const current = await this.ensureStrategy(siteId, userId);
    let document = parseContentStrategyDocument(current.document);
    if (input.document) {
      document = mergeContentStrategyDocument(document, input.document);
    }
    if (input.purpose) document.north_star.what_we_are = input.purpose;
    if (input.audience_summary) document.audience.primary.who = input.audience_summary;
    if (input.long_term_outcomes?.length) {
      document.north_star.commercial_goal = input.long_term_outcomes[0] ?? document.north_star.commercial_goal;
      document.measurement.business_outcomes = input.long_term_outcomes;
    }
    if (input.principles?.length) document.voice.writing_principles = input.principles;
    if (input.perception_goals?.length) {
      document.positioning.value_proposition = input.perception_goals[0] ?? "";
    }
    if (input.constraints?.length) {
      document.guardrails.never = input.constraints.filter((c) => /^never/i.test(c));
      document.guardrails.always = input.constraints.filter((c) => !/^never/i.test(c));
    }
    if (input.website_url) {
      await this.siteRepository.update(siteId, { website_url: input.website_url }).catch(() => null);
    }
    const flat = flattenContentStrategy(document);
    const ready = documentHasSubstance(document);
    const updated = await this.strategies.updateActive(
      siteId,
      {
        document,
        ...flat,
        website_url: input.website_url ?? current.website_url,
        generation_status: ready ? "ready" : current.generation_status,
        generated_from: "user",
        generation_error: ready ? "" : current.generation_error,
        confidence_summary: Math.max(current.confidence_summary ?? 0.4, 0.7),
      },
      userId
    );
    if (ready) {
      this.emitStatus(siteId, userId, "ready");
      this.bootstrapDefaultRoadmap(siteId, userId);
    }
    return this.hydrate(updated);
  }

  async regenerate(siteId: string, userId: string): Promise<WorkspaceStrategy> {
    const site = await this.siteRepository.findById(siteId);
    if (site?.website_url) {
      return this.generateFromWebsite(siteId, userId, site.website_url);
    }
    return this.generate(siteId, userId, { force: true, source: "ai" });
  }

  private async createStub(
    siteId: string,
    userId: string,
    opts: {
      generation_status: ContentStrategyGenerationStatus;
      websiteUrl?: string;
      source: WorkspaceStrategySource;
    }
  ): Promise<WorkspaceStrategy> {
    const document = emptyContentStrategyDocument();
    const flat = flattenContentStrategy(document);
    const created = await this.strategies.create({
      site_id: siteId,
      status: "active",
      generation_status: opts.generation_status,
      version: await this.strategies.nextVersion(siteId),
      website_url: opts.websiteUrl,
      document,
      section_confidence: {},
      purpose: flat.purpose || "Content Strategy is being prepared.",
      long_term_outcomes: flat.long_term_outcomes,
      principles: flat.principles,
      audience_summary: flat.audience_summary,
      perception_goals: flat.perception_goals,
      constraints: flat.constraints,
      generated_from: opts.source,
      confidence_summary: 0.2,
      updated_by: userId,
    });
    return this.hydrate(created);
  }

  private async markFailed(siteId: string, userId: string, message: string): Promise<WorkspaceStrategy> {
    const updated = await this.strategies.updateActive(
      siteId,
      {
        generation_status: "failed",
        generation_error: message.slice(0, 2000),
      },
      userId
    );
    this.emitStatus(siteId, userId, "failed", message);
    await this.notify(userId, siteId, false, message);
    return this.hydrate(updated);
  }

  private documentFromLegacy(strategy: WorkspaceStrategy): ContentStrategyDocument {
    const document = emptyContentStrategyDocument();
    document.north_star.what_we_are = strategy.purpose || "";
    document.north_star.commercial_goal = strategy.long_term_outcomes?.[0] || "";
    document.north_star.growth_priority = strategy.long_term_outcomes?.[1] || "";
    document.audience.primary.who = strategy.audience_summary || "";
    document.voice.writing_principles = strategy.principles ?? [];
    document.positioning.value_proposition = strategy.perception_goals?.[0] || "";
    document.guardrails.always = strategy.constraints ?? [];
    document.measurement.business_outcomes = strategy.long_term_outcomes ?? [];
    return parseContentStrategyDocument(document);
  }

  private hydrate(strategy: WorkspaceStrategy): WorkspaceStrategy {
    const document = documentHasSubstance(strategy.document)
      ? parseContentStrategyDocument(strategy.document)
      : emptyContentStrategyDocument();
    const generation_status = strategy.generation_status ?? (documentHasSubstance(document) ? "ready" : "failed");
    return {
      ...strategy,
      document: documentHasSubstance(strategy.document) ? parseContentStrategyDocument(strategy.document) : document,
      generation_status,
      section_confidence: strategy.section_confidence ?? {},
    };
  }

  private emitStatus(siteId: string, userId: string, status: ContentStrategyGenerationStatus, error?: string): void {
    void import("../../../shared/realtime/services/realtime.service")
      .then(({ RealtimeService }) => {
        container
          .resolve(RealtimeService)
          .emitToUser(userId, REALTIME_EVENTS.STRATEGY_STATUS_CHANGED, { siteId, status, error }, { siteId });
      })
      .catch((err) => {
        logger.warn("Content strategy realtime emit failed", { error: String(err) }, "WorkspaceStrategyService");
      });
  }

  private async notify(_userId: string, _siteId: string, _ok: boolean, _error?: string): Promise<void> {
    // In-app notifications are reserved for draft-ready, review, and schedule reminders.
  }

  private bootstrapDefaultRoadmap(siteId: string, userId: string): void {
    void (async () => {
      try {
        const { CampaignPlanningService } = await import("../../campaign/services/campaign-planning.service");
        await container.resolve(CampaignPlanningService).ensureDefaultRoadmap(siteId, userId);
      } catch (err) {
        logger.warn(
          "Evergreen roadmap bootstrap skipped",
          { siteId, error: err instanceof Error ? err.message : String(err) },
          "WorkspaceStrategyService"
        );
      }
    })();
  }
}

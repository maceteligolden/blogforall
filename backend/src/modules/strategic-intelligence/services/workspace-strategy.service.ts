import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import {
  WorkspaceStrategyRepository,
  type WorkspaceStrategy,
  type WorkspaceStrategySource,
} from "../repositories/workspace-strategy.repository";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { BusinessKnowledgeService } from "./business-knowledge.service";
import { NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";

export type UpdateWorkspaceStrategyInput = {
  purpose?: string;
  long_term_outcomes?: string[];
  principles?: string[];
  audience_summary?: string;
  perception_goals?: string[];
  constraints?: string[];
};

@injectable()
export class WorkspaceStrategyService {
  constructor(
    private readonly strategies: WorkspaceStrategyRepository,
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly knowledge: BusinessKnowledgeService
  ) {}

  async getActive(siteId: string): Promise<WorkspaceStrategy | null> {
    return this.strategies.findActive(siteId);
  }

  async getActiveOrThrow(siteId: string): Promise<WorkspaceStrategy> {
    const s = await this.strategies.findActive(siteId);
    if (!s) throw new NotFoundError("Workspace strategy not found");
    return s;
  }

  async listVersions(siteId: string) {
    return this.strategies.listVersions(siteId);
  }

  /**
   * Ensure an active strategy exists (stub if thin knowledge). Never blocks content.
   */
  async ensureStrategy(siteId: string, userId: string): Promise<WorkspaceStrategy> {
    const existing = await this.strategies.findActive(siteId);
    if (existing) return existing;
    return this.generate(siteId, userId, { force: false });
  }

  async generate(
    siteId: string,
    userId: string,
    opts?: { force?: boolean; source?: WorkspaceStrategySource }
  ): Promise<WorkspaceStrategy> {
    const memory = await this.memoryRepository.ensureForSite(siteId, userId);
    await this.knowledge.seedFromWorkspaceMemory(siteId, userId);
    const gaps = await this.knowledge.listGaps(siteId);
    const avgConfidence = await this.knowledge.averageConfidence(siteId);

    const audience =
      memory.strategic.target_audience?.join(", ") ||
      "target audience still being learned";
    const goals = memory.strategic.business_goals?.length
      ? memory.strategic.business_goals
      : ["Grow awareness and trust through consistent, useful content"];
    const businessType = memory.strategic.business_type?.trim() || "the business";
    const voice = memory.strategic.brand_voice?.trim() || "clear, helpful, and credible";

    const thin = !memory.strategic.business_type && !memory.strategic.target_audience?.length;
    const source: WorkspaceStrategySource =
      opts?.source ?? (thin ? "stub" : gaps.length > 8 ? "ai" : "onboarding");

    const purpose = thin
      ? `Build topical authority for ${businessType} while learning who we serve.`
      : `Create content that helps ${audience} and advances goals for ${businessType}.`;

    const draft: Partial<WorkspaceStrategy> = {
      site_id: siteId,
      status: "active",
      version: await this.strategies.nextVersion(siteId),
      purpose,
      long_term_outcomes: goals,
      principles: [
        `Sound ${voice}`,
        "Prefer evidence over hype",
        "Every post should advance a campaign objective",
      ],
      audience_summary: audience,
      perception_goals: [
        `Be seen as a trusted guide for ${audience}`,
      ],
      constraints: memory.strategic.seo_priorities?.length
        ? [`Respect SEO priorities: ${memory.strategic.seo_priorities.join(", ")}`]
        : ["Do not invent unsupported claims"],
      generated_from: source,
      confidence_summary: thin ? 0.35 : Math.min(0.9, Math.max(0.4, avgConfidence)),
      updated_by: userId,
    };

    if (opts?.force !== false) {
      await this.strategies.archiveActive(siteId);
    } else {
      const again = await this.strategies.findActive(siteId);
      if (again) return again;
    }

    const created = await this.strategies.create(draft);
    logger.info(
      "WorkspaceStrategy generated",
      { siteId, version: created.version, source, id: created._id ?? randomUUID() },
      "WorkspaceStrategyService"
    );
    return created;
  }

  async update(siteId: string, userId: string, input: UpdateWorkspaceStrategyInput): Promise<WorkspaceStrategy> {
    await this.ensureStrategy(siteId, userId);
    return this.strategies.updateActive(
      siteId,
      {
        ...input,
        generated_from: "user",
      },
      userId
    );
  }

  async regenerate(siteId: string, userId: string): Promise<WorkspaceStrategy> {
    return this.generate(siteId, userId, { force: true, source: "ai" });
  }
}

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
import { migrateStrategicMemory } from "../../../shared/utils/migrate-strategic-memory";
import { formatBusinessOneLiner } from "../../../shared/utils/format-business-context";

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

    const strategic = migrateStrategicMemory(memory.strategic);
    const audience =
      strategic.customers
        .map((c) => c.label || c.who)
        .filter(Boolean)
        .join("; ") ||
      strategic.target_audience?.join(", ") ||
      "target audience still being learned";
    const goals = strategic.business_goals?.length
      ? strategic.business_goals
      : ["Grow awareness and trust through consistent, useful content"];
    const businessType = formatBusinessOneLiner(strategic);
    const voice = strategic.brand_voice?.trim() || "clear, helpful, and credible";
    const avoid = strategic.brand_negatives?.trim();

    const thin =
      !strategic.business_description &&
      !strategic.business_type &&
      !strategic.target_audience?.length &&
      !strategic.customers.length;
    const source: WorkspaceStrategySource = opts?.source ?? (thin ? "stub" : gaps.length > 8 ? "ai" : "onboarding");

    const purpose = thin
      ? `Build topical authority for ${businessType} while learning who we serve.`
      : `Create content that helps ${audience} and advances goals for ${businessType}.`;

    const constraints: string[] = [];
    if (strategic.seo_priorities?.length) {
      constraints.push(`Respect SEO priorities: ${strategic.seo_priorities.join(", ")}`);
    }
    if (avoid) constraints.push(`Avoid brand negatives: ${avoid}`);
    if (strategic.competitors.length) {
      constraints.push(`Differentiate from competitors: ${strategic.competitors.map((c) => c.name).join(", ")}`);
    }
    if (!constraints.length) constraints.push("Do not invent unsupported claims");

    const draft: Partial<WorkspaceStrategy> = {
      site_id: siteId,
      status: "active",
      version: await this.strategies.nextVersion(siteId),
      purpose,
      long_term_outcomes: goals,
      principles: [
        `Brand voice: ${voice}`,
        "Prefer evidence over hype",
        "Every post should advance a campaign objective",
      ],
      audience_summary: audience,
      perception_goals: [`Be seen as a trusted guide for ${audience}`],
      constraints,
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

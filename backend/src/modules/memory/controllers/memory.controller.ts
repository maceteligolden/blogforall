import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { StrategyEngineService } from "../services/strategy-engine.service";
import { BehavioralRuleService } from "../services/behavioral-rule.service";
import { BusinessKnowledgeService } from "../../strategic-intelligence/services/business-knowledge.service";
import { WebsiteIngestService } from "../../orchestrator/services/website-ingest.service";
import { proposalToMemoryPatch } from "../../orchestrator/utils/website-onboarding.helper";
import type { BehavioralRule } from "../../../shared/schemas/memory-types";
import { env } from "../../../shared/config/env";
import { migrateStrategicMemory } from "../../../shared/utils/migrate-strategic-memory";
import { BadRequestError } from "../../../shared/errors";

@injectable()
export class MemoryController {
  constructor(
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly strategyEngine: StrategyEngineService,
    private readonly behavioralRuleService: BehavioralRuleService,
    private readonly businessKnowledge: BusinessKnowledgeService,
    private readonly websiteIngest: WebsiteIngestService
  ) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  getMemory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const memory = await this.memoryRepository.ensureForSite(siteId, userId);
      sendSuccess(res, "Workspace memory retrieved", {
        strategic: migrateStrategicMemory(memory.strategic),
        preferences: memory.preferences,
        operational: memory.operational,
        memory_summary: memory.memory_summary,
        content_summary: memory.content_summary,
        behavioral_rules: this.behavioralRuleService.getActiveRules(memory, 50),
        strategy_state: memory.strategy_state,
        version: memory.version,
      });
    } catch (error) {
      next(error);
    }
  };

  updateMemory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = req.validatedBody as {
        strategic?: Record<string, unknown>;
        preferences?: Record<string, unknown>;
        behavioral_rules?: BehavioralRule[];
        strategy_state?: Record<string, unknown>;
      };
      const memory = await this.memoryRepository.ensureForSite(siteId, userId);
      // Single-writer: strategic (+ mapped tone) go through beliefs → project (doc 21).
      const updated =
        env.orchestrator.strategicIntelligenceEnabled && (body.strategic || body.preferences)
          ? await this.businessKnowledge.applyStrategicPatch(siteId, userId, body, "user_explicit")
          : await this.memoryRepository.update(siteId, body as never, userId);
      // Non-strategic keys (behavioral_rules, strategy_state) when SI path used
      if (
        env.orchestrator.strategicIntelligenceEnabled &&
        (body.strategic || body.preferences) &&
        (body.behavioral_rules || body.strategy_state)
      ) {
        await this.memoryRepository.update(
          siteId,
          {
            ...(body.behavioral_rules ? { behavioral_rules: body.behavioral_rules } : {}),
            ...(body.strategy_state ? { strategy_state: body.strategy_state } : {}),
          } as never,
          userId
        );
      }
      const finalMemory = updated ?? (await this.memoryRepository.ensureForSite(siteId, userId));
      await this.behavioralRuleService.logAudit({
        siteId,
        userId,
        action: "patch",
        patchKeys: Object.keys(body),
        previousVersion: memory.version,
        newVersion: finalMemory.version,
      });
      sendSuccess(res, "Workspace memory updated", finalMemory);
    } catch (error) {
      next(error);
    }
  };

  getStrategy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const strategy = await this.strategyEngine.getStrategy(siteId, userId);
      sendSuccess(res, "Strategy retrieved", strategy);
    } catch (error) {
      next(error);
    }
  };

  generateStrategy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = (req.validatedBody ?? {}) as { horizon_weeks?: number };
      const result = await this.strategyEngine.generateStrategy(siteId, userId, {
        horizonWeeks: body.horizon_weeks,
      });
      sendSuccess(res, "Strategy generated", result);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Ingest a website URL and apply the extracted profile into workspace memory.
   * Uses body.url when provided; otherwise falls back to strategic.website_url.
   */
  fillFromWebsite = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = getJwtUserId(req);
      const siteId = this.siteId(req);
      const body = (req.validatedBody ?? {}) as { url?: string };
      const memory = await this.memoryRepository.ensureForSite(siteId, userId);
      const url = (body.url?.trim() || memory.strategic.website_url?.trim() || "").trim();
      if (!url) {
        throw new BadRequestError("Provide a website URL to fill business information.");
      }

      const proposed = await this.websiteIngest.ingestAndPropose(url);
      if (!proposed) {
        throw new BadRequestError(
          "Could not read that website. Check the URL and try again, or fill the fields manually."
        );
      }

      const patch = proposalToMemoryPatch(proposed.proposal, proposed.url);
      const strategicPatch = {
        ...((patch.strategic as Record<string, unknown>) || {}),
        website_url: proposed.url,
      };

      let updated;
      if (env.orchestrator.strategicIntelligenceEnabled) {
        updated = await this.businessKnowledge.applyStrategicPatch(
          siteId,
          userId,
          {
            strategic: strategicPatch,
            preferences: patch.preferences as Record<string, unknown> | undefined,
            ...(typeof patch.memory_summary === "string" ? { memory_summary: patch.memory_summary } : {}),
          },
          "website_inferred"
        );
      } else {
        const dotted: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(strategicPatch)) {
          if (v !== undefined) dotted[`strategic.${k}`] = v;
        }
        if (patch.preferences && typeof patch.preferences === "object") {
          for (const [k, v] of Object.entries(patch.preferences as Record<string, unknown>)) {
            if (v !== undefined) dotted[`preferences.${k}`] = v;
          }
        }
        if (typeof patch.memory_summary === "string") dotted.memory_summary = patch.memory_summary;
        updated = await this.memoryRepository.update(siteId, dotted as never, userId);
      }

      const finalMemory = updated ?? (await this.memoryRepository.ensureForSite(siteId, userId));
      await this.behavioralRuleService.logAudit({
        siteId,
        userId,
        action: "patch",
        patchKeys: ["from_website", proposed.url],
        previousVersion: memory.version,
        newVersion: finalMemory.version,
      });

      sendSuccess(res, "Business information filled from website", {
        strategic: migrateStrategicMemory({
          ...finalMemory.strategic,
          website_url: proposed.url,
        }),
        preferences: finalMemory.preferences,
        operational: finalMemory.operational,
        memory_summary: finalMemory.memory_summary,
        content_summary: finalMemory.content_summary,
        behavioral_rules: this.behavioralRuleService.getActiveRules(finalMemory, 50),
        strategy_state: finalMemory.strategy_state,
        version: finalMemory.version,
        website_url: proposed.url,
        source: proposed.source,
        summary: proposed.summary,
      });
    } catch (error) {
      next(error);
    }
  };
}

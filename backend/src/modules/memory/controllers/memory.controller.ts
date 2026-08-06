import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { WorkspaceMemoryRepository } from "../../orchestrator/repositories/workspace-memory.repository";
import { StrategyEngineService } from "../services/strategy-engine.service";
import { BehavioralRuleService } from "../services/behavioral-rule.service";
import { BusinessKnowledgeService } from "../../strategic-intelligence/services/business-knowledge.service";
import type { BehavioralRule } from "../../../shared/schemas/memory-types";
import { env } from "../../../shared/config/env";

@injectable()
export class MemoryController {
  constructor(
    private readonly memoryRepository: WorkspaceMemoryRepository,
    private readonly strategyEngine: StrategyEngineService,
    private readonly behavioralRuleService: BehavioralRuleService,
    private readonly businessKnowledge: BusinessKnowledgeService
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
        strategic: memory.strategic,
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
}

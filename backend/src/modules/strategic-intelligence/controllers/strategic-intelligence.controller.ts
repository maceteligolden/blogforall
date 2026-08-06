import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import { WorkspaceStrategyService } from "../services/workspace-strategy.service";
import { BusinessKnowledgeService } from "../services/business-knowledge.service";
import { StrategicDecisionEngineService } from "../services/strategic-decision.service";
import { CampaignService } from "../../campaign/services/campaign.service";
import { CampaignIntelligenceService } from "../services/campaign-intelligence.service";
import { DecisionProposalService } from "../services/decision-proposal.service";
import type { BusinessKnowledgeKey } from "../constants/business-knowledge.keys";
import { BUSINESS_KNOWLEDGE_KEYS } from "../constants/business-knowledge.keys";
import { BadRequestError } from "../../../shared/errors";

@injectable()
export class StrategicIntelligenceController {
  constructor(
    private readonly strategyService: WorkspaceStrategyService,
    private readonly knowledgeService: BusinessKnowledgeService,
    private readonly decisionsService: StrategicDecisionEngineService,
    private readonly campaignService: CampaignService,
    private readonly intelligenceService: CampaignIntelligenceService,
    private readonly decisionProposalService: DecisionProposalService
  ) {}

  private siteId(req: Request): string {
    return (req.validatedParams as { siteId: string }).siteId;
  }

  getStrategy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const strategy = await this.strategyService.ensureStrategy(siteId, userId);
      sendSuccess(res, "Workspace strategy", strategy);
    } catch (e) {
      next(e);
    }
  };

  updateStrategy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const body = (req.validatedBody ?? req.body) as Record<string, unknown>;
      const strategy = await this.strategyService.update(siteId, userId, {
        purpose: body.purpose as string | undefined,
        long_term_outcomes: body.long_term_outcomes as string[] | undefined,
        principles: body.principles as string[] | undefined,
        audience_summary: body.audience_summary as string | undefined,
        perception_goals: body.perception_goals as string[] | undefined,
        constraints: body.constraints as string[] | undefined,
      });
      sendSuccess(res, "Workspace strategy updated", strategy);
    } catch (e) {
      next(e);
    }
  };

  listStrategyVersions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const versions = await this.strategyService.listVersions(siteId);
      sendSuccess(res, "Workspace strategy versions", versions);
    } catch (e) {
      next(e);
    }
  };

  regenerateStrategy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const strategy = await this.strategyService.regenerate(siteId, userId);
      sendSuccess(res, "Workspace strategy regenerated", strategy);
    } catch (e) {
      next(e);
    }
  };

  listKnowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const beliefs = await this.knowledgeService.listBeliefs(siteId);
      sendSuccess(res, "Business knowledge", beliefs);
    } catch (e) {
      next(e);
    }
  };

  updateKnowledge = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const { canonicalKey } = req.validatedParams as { siteId: string; canonicalKey: string };
      const body = (req.validatedBody ?? req.body) as {
        value?: unknown;
        confidence?: number;
        source?: string;
        status?: "new" | "confirmed" | "updated" | "invalidated";
      };
      if (
        !BUSINESS_KNOWLEDGE_KEYS.includes(canonicalKey as BusinessKnowledgeKey) &&
        !canonicalKey.startsWith("business.")
      ) {
        throw new BadRequestError("Unknown knowledge key");
      }
      if (body.status === "invalidated") {
        await this.knowledgeService.invalidateBelief(
          siteId,
          canonicalKey,
          typeof body.value === "string" ? body.value : undefined
        );
        const belief = await this.knowledgeService.getBelief(siteId, canonicalKey);
        sendSuccess(res, "Knowledge invalidated", belief);
        return;
      }
      if (body.value === undefined) throw new BadRequestError("value is required");
      const belief = await this.knowledgeService.upsertBelief(siteId, userId, canonicalKey, body.value, {
        confidence: body.confidence,
        source: body.source ?? "user_explicit",
        status: body.status ?? "confirmed",
      });
      sendSuccess(res, "Knowledge updated", belief);
    } catch (e) {
      next(e);
    }
  };

  listGaps = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const gaps = await this.knowledgeService.listGaps(siteId);
      sendSuccess(res, "Knowledge gaps", gaps);
    } catch (e) {
      next(e);
    }
  };

  nextDecisions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const query = (req.validatedQuery ?? req.query) as { campaign_id?: string };
      const result = await this.decisionsService.proposeNext(siteId, userId, {
        campaignId: query.campaign_id,
      });
      sendSuccess(res, "Strategic next actions", result);
    } catch (e) {
      next(e);
    }
  };

  proposeDecision = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const body = (req.validatedBody ?? req.body) as {
        kind: string;
        campaign_id?: string;
        accept?: boolean;
      };
      if (!body.kind) throw new BadRequestError("kind is required");
      const result = await this.decisionProposalService.propose(siteId, userId, body);
      sendSuccess(res, "Decision proposal", result);
    } catch (e) {
      next(e);
    }
  };

  ensureDefaultCampaign = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const siteId = this.siteId(req);
      const userId = getJwtUserId(req);
      const campaign = await this.campaignService.ensureDefaultCampaign(siteId, userId);
      const backfill = await this.campaignService.backfillContentToDefault(siteId, userId);
      const strategyBackfill = await this.campaignService.backfillStrategyIds(siteId, userId);
      sendSuccess(res, "Default campaign ready", { campaign, backfill, strategyBackfill });
    } catch (e) {
      next(e);
    }
  };

  getCampaignIntelligence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = req.validatedParams as { siteId: string; campaignId: string };
      const intel = await this.intelligenceService.get(campaignId, siteId);
      sendSuccess(res, "Campaign intelligence", intel);
    } catch (e) {
      next(e);
    }
  };

  recomputeCampaignIntelligence = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { siteId, campaignId } = req.validatedParams as { siteId: string; campaignId: string };
      const intel = await this.intelligenceService.recompute(campaignId, siteId);
      sendSuccess(res, "Campaign intelligence recomputed", intel);
    } catch (e) {
      next(e);
    }
  };
}

import { Router } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import { StrategicIntelligenceController } from "../controllers/strategic-intelligence.controller";

const siteIdParamSchema = z.object({ siteId: z.string().min(1) });
const knowledgeKeyParamSchema = z.object({
  siteId: z.string().min(1),
  canonicalKey: z.string().min(1),
});
const campaignIntelParamSchema = z.object({
  siteId: z.string().min(1),
  campaignId: z.string().min(1),
});

const updateStrategyBodySchema = z.object({
  purpose: z.string().min(1).max(2000).optional(),
  long_term_outcomes: z.array(z.string()).optional(),
  principles: z.array(z.string()).optional(),
  audience_summary: z.string().max(2000).optional(),
  perception_goals: z.array(z.string()).optional(),
  constraints: z.array(z.string()).optional(),
});

const updateKnowledgeBodySchema = z.object({
  value: z.unknown(),
  confidence: z.number().min(0).max(1).optional(),
});

const decisionsQuerySchema = z.object({
  campaign_id: z.string().optional(),
});

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const controller = container.resolve(StrategicIntelligenceController);

router.get("/strategy", validateParams(siteIdParamSchema), controller.getStrategy);
router.patch(
  "/strategy",
  validateParams(siteIdParamSchema),
  validateBody(updateStrategyBodySchema),
  controller.updateStrategy
);
router.get("/strategy/versions", validateParams(siteIdParamSchema), controller.listStrategyVersions);
router.post("/strategy/regenerate", validateParams(siteIdParamSchema), controller.regenerateStrategy);

router.get("/knowledge", validateParams(siteIdParamSchema), controller.listKnowledge);
router.patch(
  "/knowledge/:canonicalKey",
  validateParams(knowledgeKeyParamSchema),
  validateBody(updateKnowledgeBodySchema),
  controller.updateKnowledge
);
router.get("/knowledge/gaps", validateParams(siteIdParamSchema), controller.listGaps);

router.get(
  "/decisions/next",
  validateParams(siteIdParamSchema),
  validateQuery(decisionsQuerySchema),
  controller.nextDecisions
);

router.post("/default-campaign/ensure", validateParams(siteIdParamSchema), controller.ensureDefaultCampaign);

router.get(
  "/campaigns/:campaignId/intelligence",
  validateParams(campaignIntelParamSchema),
  controller.getCampaignIntelligence
);
router.post(
  "/campaigns/:campaignId/intelligence/recompute",
  validateParams(campaignIntelParamSchema),
  controller.recomputeCampaignIntelligence
);

export default router;

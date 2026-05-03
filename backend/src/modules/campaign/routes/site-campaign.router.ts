import { Router } from "express";
import { container } from "tsyringe";
import { CampaignController } from "../controllers/campaign.controller";
import { ScheduledPostController } from "../controllers/scheduled-post.controller";
import { CampaignTemplateController } from "../controllers/campaign-template.controller";
import { CampaignAgentController } from "../controllers/campaign-agent.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import * as V from "../validations/campaign-route.validation";

const router = Router({ mergeParams: true });
router.use(authMiddleware, validateParams(V.siteIdParamSchema));

const campaignController = container.resolve(CampaignController);
const scheduledPostController = container.resolve(ScheduledPostController);
const templateController = container.resolve(CampaignTemplateController);
const campaignAgentController = container.resolve(CampaignAgentController);

router.post("/", validateBody(V.createCampaignBodySchema), campaignController.create);
router.get("/my-campaigns", validateQuery(V.campaignListQuerySchema), campaignController.getUserCampaigns);
router.get("/date-range", validateQuery(V.campaignDateRangeQuerySchema), campaignController.getByDateRange);
router.get("/", validateQuery(V.campaignListQuerySchema), campaignController.getAllCampaigns);

router.post("/scheduled-posts", validateBody(V.createScheduledPostBodySchema), scheduledPostController.create);
router.get(
  "/scheduled-posts/my-posts",
  validateQuery(V.scheduledPostListQuerySchema),
  scheduledPostController.getUserScheduledPosts
);
router.get(
  "/scheduled-posts/date-range",
  validateQuery(V.scheduledPostDateRangeQuerySchema),
  scheduledPostController.getByDateRange
);
router.get(
  "/scheduled-posts",
  validateQuery(V.scheduledPostListQuerySchema),
  scheduledPostController.getAllScheduledPosts
);
router.get("/scheduled-posts/:id", validateParams(V.scheduledPostIdParamSchema), scheduledPostController.getById);
router.put(
  "/scheduled-posts/:id",
  validateParams(V.scheduledPostIdParamSchema),
  validateBody(V.updateScheduledPostBodySchema),
  scheduledPostController.update
);
router.delete("/scheduled-posts/:id", validateParams(V.scheduledPostIdParamSchema), scheduledPostController.delete);
router.post(
  "/scheduled-posts/:id/cancel",
  validateParams(V.scheduledPostIdParamSchema),
  scheduledPostController.cancel
);
router.post(
  "/scheduled-posts/:id/move-to-campaign",
  validateParams(V.scheduledPostIdParamSchema),
  validateBody(V.moveScheduledPostToCampaignBodySchema),
  scheduledPostController.moveToCampaign
);
router.post(
  "/scheduled-posts/:id/remove-from-campaign",
  validateParams(V.scheduledPostIdParamSchema),
  scheduledPostController.removeFromCampaign
);

router.post("/templates", validateBody(V.createCampaignTemplateBodySchema), templateController.create);
router.get("/templates", validateQuery(V.campaignTemplateListQuerySchema), templateController.getAll);
router.get("/templates/type/:type", validateParams(V.templateTypeParamSchema), templateController.getByType);
router.get("/templates/:id", validateParams(V.templateIdParamSchema), templateController.getById);
router.put(
  "/templates/:id",
  validateParams(V.templateIdParamSchema),
  validateBody(V.updateCampaignTemplateBodySchema),
  templateController.update
);
router.delete("/templates/:id", validateParams(V.templateIdParamSchema), templateController.delete);
router.post("/templates/:id/activate", validateParams(V.templateIdParamSchema), templateController.activate);
router.post("/templates/:id/deactivate", validateParams(V.templateIdParamSchema), templateController.deactivate);

router.post("/agent/chat", validateBody(V.agentChatBodySchema), campaignAgentController.chat);
router.post(
  "/agent/create-from-proposal",
  validateBody(V.agentCreateFromProposalBodySchema),
  campaignAgentController.createFromProposal
);

router.get("/:id/stats", validateParams(V.campaignIdParamSchema), campaignController.getByIdWithStats);
router.get("/:id", validateParams(V.campaignIdParamSchema), campaignController.getById);
router.put(
  "/:id",
  validateParams(V.campaignIdParamSchema),
  validateBody(V.updateCampaignBodySchema),
  campaignController.update
);
router.delete("/:id", validateParams(V.campaignIdParamSchema), campaignController.delete);
router.post("/:id/activate", validateParams(V.campaignIdParamSchema), campaignController.activate);
router.post("/:id/pause", validateParams(V.campaignIdParamSchema), campaignController.pause);
router.post("/:id/cancel", validateParams(V.campaignIdParamSchema), campaignController.cancel);

export default router;

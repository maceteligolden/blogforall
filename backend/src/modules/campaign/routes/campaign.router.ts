import { Router } from "express";
import { container } from "tsyringe";
import { CampaignController } from "../controllers/campaign.controller";
import { ScheduledPostController } from "../controllers/scheduled-post.controller";
import { CampaignTemplateController } from "../controllers/campaign-template.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const campaignController = container.resolve(CampaignController);
const scheduledPostController = container.resolve(ScheduledPostController);
const templateController = container.resolve(CampaignTemplateController);

// IMPORTANT: Specific routes must come BEFORE parameterized routes (/:id)
// Otherwise Express will match /:id first and treat "scheduled-posts" as an ID

// Campaign routes (protected) - specific routes first
router.post("/", authMiddleware, campaignController.create);
router.get("/my-campaigns", authMiddleware, campaignController.getUserCampaigns);
router.get("/date-range", authMiddleware, campaignController.getByDateRange);
router.get("/", authMiddleware, campaignController.getAllCampaigns);

// Scheduled post routes (protected) - must come before /:id
router.post("/scheduled-posts", authMiddleware, scheduledPostController.create);
router.get("/scheduled-posts/my-posts", authMiddleware, scheduledPostController.getUserScheduledPosts);
router.get("/scheduled-posts/date-range", authMiddleware, scheduledPostController.getByDateRange);
router.get("/scheduled-posts", authMiddleware, scheduledPostController.getAllScheduledPosts);
router.get("/scheduled-posts/:id", authMiddleware, scheduledPostController.getById);
router.put("/scheduled-posts/:id", authMiddleware, scheduledPostController.update);
router.delete("/scheduled-posts/:id", authMiddleware, scheduledPostController.delete);
router.post("/scheduled-posts/:id/cancel", authMiddleware, scheduledPostController.cancel);
router.post("/scheduled-posts/:id/move-to-campaign", authMiddleware, scheduledPostController.moveToCampaign);
router.post("/scheduled-posts/:id/remove-from-campaign", authMiddleware, scheduledPostController.removeFromCampaign);

// Campaign template routes (protected) - must come before /:id
router.post("/templates", authMiddleware, templateController.create);
router.get("/templates/type/:type", authMiddleware, templateController.getByType);
router.get("/templates", authMiddleware, templateController.getAll);
router.get("/templates/:id", authMiddleware, templateController.getById);
router.put("/templates/:id", authMiddleware, templateController.update);
router.delete("/templates/:id", authMiddleware, templateController.delete);
router.post("/templates/:id/activate", authMiddleware, templateController.activate);
router.post("/templates/:id/deactivate", authMiddleware, templateController.deactivate);

// Parameterized campaign routes (/:id) - must come LAST
router.get("/:id/stats", authMiddleware, campaignController.getByIdWithStats);
router.get("/:id", authMiddleware, campaignController.getById);
router.put("/:id", authMiddleware, campaignController.update);
router.delete("/:id", authMiddleware, campaignController.delete);
router.post("/:id/activate", authMiddleware, campaignController.activate);
router.post("/:id/pause", authMiddleware, campaignController.pause);
router.post("/:id/cancel", authMiddleware, campaignController.cancel);

export default router;

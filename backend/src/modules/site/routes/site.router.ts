import { Router } from "express";
import { container } from "tsyringe";
import { SiteController } from "../controllers/site.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const siteController = container.resolve(SiteController);

// All routes require authentication
router.post("/", authMiddleware, siteController.create);
router.get("/", authMiddleware, siteController.list);
router.get("/:id", authMiddleware, siteController.getById);
router.patch("/:id", authMiddleware, siteController.update);
router.delete("/:id", authMiddleware, siteController.delete);

export default router;

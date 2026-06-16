import { Router } from "express";
import { container } from "tsyringe";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { UsageController } from "../controllers/usage.controller";

const router = Router();
const usageController = container.resolve(UsageController);

router.get("/tokens", authMiddleware, usageController.getTokenUsage);

export default router;

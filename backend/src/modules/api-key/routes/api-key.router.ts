import { Router } from "express";
import { container } from "tsyringe";
import { ApiKeyController } from "../controllers/api-key.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const apiKeyController = container.resolve(ApiKeyController);

// All routes require authentication
router.post("/", authMiddleware, apiKeyController.create);
router.get("/", authMiddleware, apiKeyController.list);
router.delete("/:accessKeyId", authMiddleware, apiKeyController.delete);

export default router;


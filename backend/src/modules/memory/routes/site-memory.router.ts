import { Router } from "express";
import { container } from "tsyringe";
import { z } from "zod";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { MemoryController } from "../controllers/memory.controller";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";

const siteIdParamSchema = z.object({ siteId: z.string().min(1) });

const updateMemoryBodySchema = z.object({
  strategic: z.record(z.unknown()).optional(),
  preferences: z.record(z.unknown()).optional(),
  behavioral_rules: z.array(z.unknown()).optional(),
  strategy_state: z.record(z.unknown()).optional(),
});

const generateStrategyBodySchema = z.object({
  horizon_weeks: z.number().min(1).max(12).optional(),
});

const router = Router({ mergeParams: true });
router.use(authMiddleware);

const controller = container.resolve(MemoryController);

router.get("/", validateParams(siteIdParamSchema), controller.getMemory);
router.patch("/", validateParams(siteIdParamSchema), validateBody(updateMemoryBodySchema), controller.updateMemory);
router.get("/strategy", validateParams(siteIdParamSchema), controller.getStrategy);
router.post(
  "/strategy/generate",
  validateParams(siteIdParamSchema),
  validateBody(generateStrategyBodySchema),
  controller.generateStrategy
);

export default router;

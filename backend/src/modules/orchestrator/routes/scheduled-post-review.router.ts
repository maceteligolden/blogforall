import { Router } from "express";
import { container } from "tsyringe";
import { ScheduledPostReviewController } from "../controllers/scheduled-post-review.controller";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";
import {
  reviewReworkBodySchema,
  reviewTokenParamSchema,
} from "../validations/scheduled-post-review.validation";

/**
 * Public router for the email-driven scheduled-post review flow. Mounted at
 * /scheduled-post-review (no auth middleware) — the URL itself bears a
 * single-use signed token verified by ScheduledPostReviewService.
 *
 *  - GET    /:token            — load the preview context
 *  - POST   /:token/approve    — approve and let the publish phase take over
 *  - POST   /:token/rework     — capture comments + re-trigger preparation
 */
const router = Router();

const controller = container.resolve(ScheduledPostReviewController);

router.get("/:token", validateParams(reviewTokenParamSchema), controller.getContext);
router.post("/:token/approve", validateParams(reviewTokenParamSchema), controller.approve);
router.post(
  "/:token/rework",
  validateParams(reviewTokenParamSchema),
  validateBody(reviewReworkBodySchema),
  controller.rework
);

export default router;

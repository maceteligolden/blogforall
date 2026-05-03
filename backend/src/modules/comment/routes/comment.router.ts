import { Router } from "express";
import { z } from "zod";
import { container } from "tsyringe";
import { CommentController } from "../controllers/comment.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import { createCommentSchema, updateCommentSchema, commentQuerySchema } from "../validations/comment.validation";

const blogIdParams = z.object({ blogId: z.string().min(1) });
const commentIdParams = z.object({ id: z.string().min(1) });
const repliesParams = z.object({ commentId: z.string().min(1) });

const router = Router();
const commentController = container.resolve(CommentController);

router.post("/", validateBody(createCommentSchema), commentController.create);
router.get(
  "/blog/:blogId",
  validateParams(blogIdParams),
  validateQuery(commentQuerySchema),
  commentController.getByBlog
);
router.get("/:commentId/replies", validateParams(repliesParams), commentController.getReplies);
router.get("/:id", validateParams(commentIdParams), commentController.getById);
router.post("/:id/like", validateParams(commentIdParams), commentController.toggleLike);

router.put(
  "/:id",
  authMiddleware,
  validateParams(commentIdParams),
  validateBody(updateCommentSchema),
  commentController.update
);
router.delete("/:id", authMiddleware, validateParams(commentIdParams), commentController.delete);

export default router;

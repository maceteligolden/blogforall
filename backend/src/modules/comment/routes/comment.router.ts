import { Router } from "express";
import { container } from "tsyringe";
import { CommentController } from "../controllers/comment.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const commentController = container.resolve(CommentController);

// Public routes (guests can comment and like)
router.post("/", commentController.create);
router.get("/blog/:blogId", commentController.getByBlog);
router.get("/:id", commentController.getById);
router.get("/:commentId/replies", commentController.getReplies);
router.post("/:id/like", commentController.toggleLike);

// Protected routes (require authentication)
router.put("/:id", authMiddleware, commentController.update);
router.delete("/:id", authMiddleware, commentController.delete);

export default router;

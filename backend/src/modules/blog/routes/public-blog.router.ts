import { Router } from "express";
import { container } from "tsyringe";
import { PublicBlogController } from "../controllers/public-blog.controller";
import { apiKeyAuthMiddleware } from "../../../shared/middlewares/api-key-auth.middleware";

const router = Router();
const publicBlogController = container.resolve(PublicBlogController);

// All routes require API key authentication
router.get("/", apiKeyAuthMiddleware, publicBlogController.getPublishedBlogs);
router.get("/:id", apiKeyAuthMiddleware, publicBlogController.getPublishedBlogById);
router.get("/slug/:slug", apiKeyAuthMiddleware, publicBlogController.getPublishedBlogBySlug);

export default router;


import { Router } from "express";
import { container } from "tsyringe";
import { PublicBlogController } from "../controllers/public-blog.controller";
import { apiKeyAuthMiddleware } from "../../../shared/middlewares/api-key-auth.middleware";
import { validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import {
  blogQuerySchema,
  categoryIdParamSchema,
  publicBlogIdParamSchema,
  publicBlogSlugParamSchema,
  publicCategoryQuerySchema,
} from "../validations/public-blog.validation";

const router = Router();
const publicBlogController = container.resolve(PublicBlogController);

router.get("/", apiKeyAuthMiddleware, validateQuery(blogQuerySchema), publicBlogController.getPublishedBlogs);
router.get(
  "/categories",
  apiKeyAuthMiddleware,
  validateQuery(publicCategoryQuerySchema),
  publicBlogController.getCategories
);
router.get(
  "/categories/:categoryId",
  apiKeyAuthMiddleware,
  validateParams(categoryIdParamSchema),
  validateQuery(blogQuerySchema),
  publicBlogController.getBlogsByCategory
);
router.get(
  "/slug/:slug",
  apiKeyAuthMiddleware,
  validateParams(publicBlogSlugParamSchema),
  validateQuery(blogQuerySchema),
  publicBlogController.getPublishedBlogBySlug
);
router.get(
  "/:id",
  apiKeyAuthMiddleware,
  validateParams(publicBlogIdParamSchema),
  validateQuery(blogQuerySchema),
  publicBlogController.getPublishedBlogById
);

export default router;

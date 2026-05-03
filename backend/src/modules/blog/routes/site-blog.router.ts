import { Router, type RequestHandler } from "express";
import { container } from "tsyringe";
import { BlogController } from "../controllers/blog.controller";
import { BlogReviewController } from "../controllers/blog-review.controller";
import { BlogGenerationController } from "../controllers/blog-generation.controller";
import { ImageController } from "../controllers/image.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import { uploadSingle, uploadMultiple } from "../../../shared/middlewares/upload.middleware";
import {
  siteIdParamSchema,
  siteAndBlogIdParamSchema,
  siteAndSlugParamSchema,
  siteBlogIdParamSchema,
  siteBlogVersionParamSchema,
  blogQuerySchema,
  createBlogSchema,
  updateBlogSchema,
  scheduleBlogSchema,
  blogGenerationAnalyzeBodySchema,
  blogGenerationBodySchema,
  blogReviewBodySchema,
  applyReviewBodySchema,
  applyOneBodySchema,
} from "../validations/blog-route.validation";

const router = Router({ mergeParams: true });
const blogController = container.resolve(BlogController);
const blogReviewController = container.resolve(BlogReviewController);
const blogGenerationController = container.resolve(BlogGenerationController);
const imageController = container.resolve(ImageController);

const siteParams = validateParams(siteIdParamSchema);

// Static / multi-segment paths before /:id
router.post(
  "/generate/analyze",
  authMiddleware,
  siteParams,
  validateBody(blogGenerationAnalyzeBodySchema),
  blogGenerationController.analyzePrompt
);
router.post(
  "/generate",
  authMiddleware,
  siteParams,
  validateBody(blogGenerationBodySchema),
  blogGenerationController.generateBlog
);
router.post(
  "/images/upload",
  authMiddleware,
  siteParams,
  uploadSingle as unknown as RequestHandler,
  imageController.uploadSingle
);
router.post(
  "/images/upload-multiple",
  authMiddleware,
  siteParams,
  uploadMultiple as unknown as RequestHandler,
  imageController.uploadMultiple
);

router.get("/my-blogs", authMiddleware, siteParams, validateQuery(blogQuerySchema), blogController.getUserBlogs);

router.post(
  "/:blogId/review",
  authMiddleware,
  validateParams(siteBlogIdParamSchema),
  validateBody(blogReviewBodySchema),
  blogReviewController.reviewBlog
);
router.post("/review", authMiddleware, siteParams, validateBody(blogReviewBodySchema), blogReviewController.reviewBlog);
router.post(
  "/:blogId/review/apply",
  authMiddleware,
  validateParams(siteBlogIdParamSchema),
  validateBody(applyReviewBodySchema),
  blogReviewController.applyReview
);
router.post(
  "/:blogId/review/apply-one",
  authMiddleware,
  validateParams(siteBlogIdParamSchema),
  validateBody(applyOneBodySchema),
  blogReviewController.applyOne
);
router.post(
  "/:blogId/restore/:version",
  authMiddleware,
  validateParams(siteBlogVersionParamSchema),
  blogReviewController.restoreVersion
);

router.post("/", authMiddleware, siteParams, validateBody(createBlogSchema), blogController.create);

router.get(
  "/slug/:slug",
  validateParams(siteAndSlugParamSchema),
  validateQuery(blogQuerySchema),
  blogController.getBySlug
);

router.get("/:id", authMiddleware, validateParams(siteAndBlogIdParamSchema), blogController.getById);
router.put(
  "/:id",
  authMiddleware,
  validateParams(siteAndBlogIdParamSchema),
  validateBody(updateBlogSchema),
  blogController.update
);
router.delete("/:id", authMiddleware, validateParams(siteAndBlogIdParamSchema), blogController.delete);
router.post("/:id/publish", authMiddleware, validateParams(siteAndBlogIdParamSchema), blogController.publish);
router.post("/:id/unpublish", authMiddleware, validateParams(siteAndBlogIdParamSchema), blogController.unpublish);
router.post(
  "/:id/schedule",
  authMiddleware,
  validateParams(siteAndBlogIdParamSchema),
  validateBody(scheduleBlogSchema),
  blogController.schedulePublish
);
router.get("/:id/schedule", authMiddleware, validateParams(siteAndBlogIdParamSchema), blogController.getSchedule);
router.delete(
  "/:id/schedule",
  authMiddleware,
  validateParams(siteAndBlogIdParamSchema),
  blogController.unschedulePublish
);
router.post("/:id/like", validateParams(siteAndBlogIdParamSchema), blogController.toggleLike);

router.get("/", validateParams(siteIdParamSchema), validateQuery(blogQuerySchema), blogController.getAllBlogs);

export default router;

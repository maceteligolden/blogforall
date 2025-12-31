import { Router } from "express";
import { container } from "tsyringe";
import { BlogController } from "../controllers/blog.controller";
import { ImageController } from "../controllers/image.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { uploadSingle, uploadMultiple } from "../../../shared/middlewares/upload.middleware";

const router = Router();
const blogController = container.resolve(BlogController);
const imageController = container.resolve(ImageController);

// Protected routes (require authentication)
router.post("/", authMiddleware, blogController.create);
router.get("/my-blogs", authMiddleware, blogController.getUserBlogs);
router.get("/:id", authMiddleware, blogController.getById);
router.put("/:id", authMiddleware, blogController.update);
router.delete("/:id", authMiddleware, blogController.delete);
router.post("/:id/publish", authMiddleware, blogController.publish);
router.post("/:id/unpublish", authMiddleware, blogController.unpublish);

// Image upload routes (protected)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post("/images/upload", authMiddleware, uploadSingle as any, imageController.uploadSingle);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
router.post("/images/upload-multiple", authMiddleware, uploadMultiple as any, imageController.uploadMultiple);

// Public routes (no authentication required)
router.get("/", blogController.getAllBlogs);
router.get("/slug/:slug", blogController.getBySlug);
router.post("/:id/like", blogController.toggleLike);

export default router;


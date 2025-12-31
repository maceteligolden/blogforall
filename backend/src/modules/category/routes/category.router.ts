import { Router } from "express";
import { container } from "tsyringe";
import { CategoryController } from "../controllers/category.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const categoryController = container.resolve(CategoryController);

// All routes require authentication
router.post("/", authMiddleware, categoryController.create);
router.get("/", authMiddleware, categoryController.list);
router.get("/:id", authMiddleware, categoryController.getById);
router.put("/:id", authMiddleware, categoryController.update);
router.delete("/:id", authMiddleware, categoryController.delete);

export default router;


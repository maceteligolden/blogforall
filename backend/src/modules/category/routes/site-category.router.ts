import { Router } from "express";
import { container } from "tsyringe";
import { CategoryController } from "../controllers/category.controller";
import { validateBody, validateParams, validateQuery } from "../../../shared/middlewares/validate.middleware";
import { createCategorySchema, updateCategorySchema, importCategoriesSchema } from "../validations/category.validation";
import { z } from "zod";
import { siteIdParamSchema, siteAndCategoryIdParamSchema } from "../validations/category-route.validation";

const categoryListQuerySchema = z.object({
  tree: z.enum(["true", "false"]).optional(),
  include_inactive: z.enum(["true", "false"]).optional(),
});

const router = Router({ mergeParams: true });
const categoryController = container.resolve(CategoryController);

router.post(
  "/import",
  validateParams(siteIdParamSchema),
  validateBody(importCategoriesSchema),
  categoryController.importCategories
);
router.post("/", validateParams(siteIdParamSchema), validateBody(createCategorySchema), categoryController.create);
router.get("/", validateParams(siteIdParamSchema), validateQuery(categoryListQuerySchema), categoryController.list);
router.get("/:id", validateParams(siteAndCategoryIdParamSchema), categoryController.getById);
router.put(
  "/:id",
  validateParams(siteAndCategoryIdParamSchema),
  validateBody(updateCategorySchema),
  categoryController.update
);
router.delete("/:id", validateParams(siteAndCategoryIdParamSchema), categoryController.delete);

export default router;

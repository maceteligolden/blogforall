import { Router } from "express";
import { container } from "tsyringe";
import { ApiKeyController } from "../../api-key/controllers/api-key.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";
import { createApiKeySchema } from "../../api-key/validations/api-key.validation";
import { siteIdParamSchema } from "../validations/site.validation";
import { z } from "zod";

const accessKeyIdParamSchema = z.object({
  id: z.string().min(1),
  accessKeyId: z.string().min(1),
});

const router = Router({ mergeParams: true });
const apiKeyController = container.resolve(ApiKeyController);

router.get("/", authMiddleware, validateParams(siteIdParamSchema), apiKeyController.list);
router.post(
  "/",
  authMiddleware,
  validateParams(siteIdParamSchema),
  validateBody(createApiKeySchema),
  apiKeyController.create
);
router.delete("/:accessKeyId", authMiddleware, validateParams(accessKeyIdParamSchema), apiKeyController.delete);

export default router;

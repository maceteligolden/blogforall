import { Router } from "express";
import { container } from "tsyringe";
import { IntegrationController } from "../controllers/integration.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateBody, validateParams } from "../../../shared/middlewares/validate.middleware";
import { siteIdParamSchema } from "../../site/validations/site.validation";
import { framerSaveBodySchema, framerTestBodySchema } from "../validations/integration.validation";

const router = Router({ mergeParams: true });
const controller = container.resolve(IntegrationController);

router.get("/", authMiddleware, validateParams(siteIdParamSchema), controller.list);
router.get("/destinations", authMiddleware, validateParams(siteIdParamSchema), controller.listDestinations);
router.post(
  "/framer/test",
  authMiddleware,
  validateParams(siteIdParamSchema),
  validateBody(framerTestBodySchema),
  controller.testFramer
);
router.post(
  "/framer",
  authMiddleware,
  validateParams(siteIdParamSchema),
  validateBody(framerSaveBodySchema),
  controller.saveFramer
);
router.get("/framer", authMiddleware, validateParams(siteIdParamSchema), controller.getFramer);
router.post("/framer/sync", authMiddleware, validateParams(siteIdParamSchema), controller.syncFramer);
router.delete("/framer", authMiddleware, validateParams(siteIdParamSchema), controller.disconnectFramer);

export default router;

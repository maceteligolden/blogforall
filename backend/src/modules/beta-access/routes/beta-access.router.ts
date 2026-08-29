import { Router } from "express";
import { container } from "tsyringe";
import { validateBody, validateQuery } from "../../../shared/middlewares/validate.middleware";
import { BetaAccessController } from "../controllers/beta-access.controller";
import { betaAccessTokenSchema } from "../validations/beta-access.validation";

const router = Router();
const controller = container.resolve(BetaAccessController);

router.get("/", validateQuery(betaAccessTokenSchema), controller.getContext);
router.post("/approve", validateBody(betaAccessTokenSchema), controller.approve);
router.post("/reject", validateBody(betaAccessTokenSchema), controller.reject);

export default router;

import { Router } from "express";
import { container } from "tsyringe";
import { ReferralController } from "../controllers/referral.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const referralController = container.resolve(ReferralController);

router.get("/me", authMiddleware, referralController.getDashboard);

export default router;

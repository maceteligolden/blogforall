import { Router } from "express";
import { container } from "tsyringe";
import { WaitlistController } from "../controllers/waitlist.controller";
import { validateBody } from "../../../shared/middlewares/validate.middleware";
import { joinWaitlistSchema } from "../validations/waitlist.validation";

const router = Router();
const waitlistController = container.resolve(WaitlistController);

router.post("/", validateBody(joinWaitlistSchema), waitlistController.join);

export default router;

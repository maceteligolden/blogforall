import { Router } from "express";
import { container } from "tsyringe";
import { NotificationController } from "../controllers/notification.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";

const router = Router();
const controller = container.resolve(NotificationController);

router.get("/", authMiddleware, controller.list);
router.get("/unread-count", authMiddleware, controller.getUnreadCount);
router.patch("/read-all", authMiddleware, controller.markAllAsRead);
router.patch("/:id/read", authMiddleware, controller.markAsRead);

export default router;

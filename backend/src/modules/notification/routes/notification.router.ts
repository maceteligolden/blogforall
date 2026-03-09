import { Router } from "express";
import { container } from "tsyringe";
import { NotificationController } from "../controllers/notification.controller";
import { authMiddleware } from "../../../shared/middlewares/auth.middleware";
import { validateQuery, validateParams } from "../../../shared/middlewares/validate.middleware";
import { listNotificationsQuerySchema, notificationIdParamSchema } from "../validations/notification.validation";

const router = Router();
const controller = container.resolve(NotificationController);

router.get("/", authMiddleware, validateQuery(listNotificationsQuerySchema), controller.list);
router.get("/unread-count", authMiddleware, controller.getUnreadCount);
router.patch("/read-all", authMiddleware, controller.markAllAsRead);
router.patch("/:id/read", authMiddleware, validateParams(notificationIdParamSchema), controller.markAsRead);

export default router;

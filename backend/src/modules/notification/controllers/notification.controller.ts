import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service";
import { sendSuccess, sendNoContent } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { ZodError } from "zod";
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from "../validations/notification.validation";

@injectable()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const query = listNotificationsQuerySchema.parse(req.query);
      const result = await this.notificationService.listByUserId(userId, {
        page: query.page,
        limit: query.limit,
        since: query.since,
      });
      sendSuccess(res, "Notifications retrieved", result);
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        return next(new BadRequestError(message));
      }
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = await this.notificationService.getUnreadCount(userId);
      sendSuccess(res, "Unread count retrieved", { count });
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = notificationIdParamSchema.parse(req.params);
      const notification = await this.notificationService.markAsRead(id, userId);
      if (!notification) {
        return next(new BadRequestError("Notification not found or already read"));
      }
      sendSuccess(res, "Notification marked as read", notification);
    } catch (error) {
      if (error instanceof ZodError) {
        const message = error.errors.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
        return next(new BadRequestError(message));
      }
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = await this.notificationService.markAllAsRead(userId);
      sendSuccess(res, "All notifications marked as read", { markedCount: count });
    } catch (error) {
      next(error);
    }
  };
}

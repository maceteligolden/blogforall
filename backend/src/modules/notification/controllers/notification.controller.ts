import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { NotificationService } from "../services/notification.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import type { ListNotificationsQuery, NotificationIdParam } from "../validations/notification.validation";

@injectable()
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * PSEUDOCODE:
   * 1. GET userId from req.user, query from req.validatedQuery
   * 2. CALL service.listByUserId(userId, { page, limit, since })
   * 3. SEND success response with result
   * 4. ON error: next(error)
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const query = req.validatedQuery as ListNotificationsQuery;
      const result = await this.notificationService.listByUserId(userId, {
        page: query.page,
        limit: query.limit,
        since: query.since,
      });
      sendSuccess(res, "Notifications retrieved", result);
    } catch (error: unknown) {
      next(error);
    }
  };

  /**
   * PSEUDOCODE:
   * 1. GET userId from req.user
   * 2. CALL service.getUnreadCount(userId)
   * 3. SEND success response with { count }
   * 4. ON error: next(error)
   */
  getUnreadCount = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = await this.notificationService.getUnreadCount(userId);
      sendSuccess(res, "Unread count retrieved", { count });
    } catch (error: unknown) {
      next(error);
    }
  };

  /**
   * PSEUDOCODE:
   * 1. GET userId from req.user, id from req.validatedParams
   * 2. CALL service.markAsRead(id, userId)
   * 3. IF no notification: next(BadRequestError) and return
   * 4. SEND success response with notification
   * 5. ON error: next(error)
   */
  markAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.validatedParams as NotificationIdParam;
      const notification = await this.notificationService.markAsRead(id, userId);
      if (!notification) {
        return next(new BadRequestError("Notification not found or already read"));
      }
      sendSuccess(res, "Notification marked as read", notification);
    } catch (error: unknown) {
      next(error);
    }
  };

  /**
   * PSEUDOCODE:
   * 1. GET userId from req.user
   * 2. CALL service.markAllAsRead(userId)
   * 3. SEND success response with { markedCount }
   * 4. ON error: next(error)
   */
  markAllAsRead = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const count = await this.notificationService.markAllAsRead(userId);
      sendSuccess(res, "All notifications marked as read", { markedCount: count });
    } catch (error: unknown) {
      next(error);
    }
  };
}

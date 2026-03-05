import { injectable } from "tsyringe";
import NotificationModel, { Notification } from "../../../shared/schemas/notification.schema";
import { PaginatedResponse } from "../../../shared/interfaces";
import { NotificationStatus } from "../../../shared/constants";

@injectable()
export class NotificationRepository {
  async save(notification: Partial<Notification>): Promise<Notification> {
    const doc = new NotificationModel(notification);
    return doc.save() as unknown as Promise<Notification>;
  }

  async findById(id: string): Promise<Notification | null> {
    return NotificationModel.findById(id).lean() as Promise<Notification | null>;
  }

  async findByUserId(
    userId: string,
    options: { page?: number; limit?: number; since?: Date } = {}
  ): Promise<PaginatedResponse<Notification>> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const query: Record<string, unknown> = { recipient_user_id: userId, channel: "in_app" };
    if (options.since) {
      query.created_at = { $gte: options.since };
    }

    const [data, total] = await Promise.all([
      NotificationModel.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(query),
    ]);

    return {
      data: data as Notification[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async updateStatus(
    id: string,
    status: NotificationStatus,
    extra?: { email_message_id?: string; sent_at?: Date; failed_at?: Date; read_at?: Date }
  ): Promise<Notification | null> {
    const update: Record<string, unknown> = { status, updated_at: new Date(), ...extra };
    return NotificationModel.findByIdAndUpdate(id, update, { new: true }).lean() as Promise<Notification | null>;
  }

  async markRead(id: string, userId: string): Promise<Notification | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, recipient_user_id: userId },
      { $set: { read_at: new Date(), status: NotificationStatus.READ, updated_at: new Date() } },
      { new: true }
    ).lean() as Promise<Notification | null>;
  }

  async markAllRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { recipient_user_id: userId, channel: "in_app", read_at: null },
      { $set: { read_at: new Date(), status: NotificationStatus.READ, updated_at: new Date() } }
    );
    return result.modifiedCount;
  }

  async countUnreadByUserId(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      recipient_user_id: userId,
      channel: "in_app",
      read_at: null,
    });
  }
}

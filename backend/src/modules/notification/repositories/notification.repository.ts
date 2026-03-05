import { injectable } from "tsyringe";
import NotificationModel, { Notification } from "../../../shared/schemas/notification.schema";
import { PaginatedResponse } from "../../../shared/interfaces";
import { NotificationStatus } from "../../../shared/constants";

@injectable()
export class NotificationRepository {
  /**
   * PSEUDOCODE:
   * 1. CREATE new document from notification
   * 2. SAVE to DB
   * 3. RETURN saved document
   */
  async save(notification: Partial<Notification>): Promise<Notification> {
    const doc = new NotificationModel(notification);
    return doc.save() as unknown as Promise<Notification>;
  }

  /**
   * PSEUDOCODE:
   * 1. FIND one document by _id
   * 2. RETURN lean document or null
   */
  async findById(id: string): Promise<Notification | null> {
    return NotificationModel.findById(id).lean() as Promise<Notification | null>;
  }

  /**
   * PSEUDOCODE:
   * 1. BUILD query: recipient_user_id = userId, channel = in_app, optional created_at >= since
   * 2. COMPUTE skip from page and limit (cap limit at 100)
   * 3. PARALLEL: FIND documents (sort by created_at desc, skip, limit) AND countDocuments
   * 4. RETURN { data, pagination: { page, limit, total, totalPages } }
   */
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

  /**
   * PSEUDOCODE:
   * 1. BUILD update object: status, updated_at, spread extra fields
   * 2. FIND by id AND UPDATE with new: true
   * 3. RETURN updated document or null
   */
  async updateStatus(
    id: string,
    status: NotificationStatus,
    extra?: { email_message_id?: string; sent_at?: Date; failed_at?: Date; read_at?: Date }
  ): Promise<Notification | null> {
    const update: Record<string, unknown> = { status, updated_at: new Date(), ...extra };
    return NotificationModel.findByIdAndUpdate(id, update, { new: true }).lean() as Promise<Notification | null>;
  }

  /**
   * PSEUDOCODE:
   * 1. FIND one where _id = id AND recipient_user_id = userId
   * 2. SET read_at = now, status = READ, updated_at = now
   * 3. RETURN updated document or null
   */
  async markRead(id: string, userId: string): Promise<Notification | null> {
    return NotificationModel.findOneAndUpdate(
      { _id: id, recipient_user_id: userId },
      { $set: { read_at: new Date(), status: NotificationStatus.READ, updated_at: new Date() } },
      { new: true }
    ).lean() as Promise<Notification | null>;
  }

  /**
   * PSEUDOCODE:
   * 1. UPDATE many where recipient_user_id = userId, channel = in_app, read_at is null
   * 2. SET read_at = now, status = READ, updated_at = now
   * 3. RETURN modifiedCount
   */
  async markAllRead(userId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { recipient_user_id: userId, channel: "in_app", read_at: null },
      { $set: { read_at: new Date(), status: NotificationStatus.READ, updated_at: new Date() } }
    );
    return result.modifiedCount;
  }

  /**
   * PSEUDOCODE:
   * 1. COUNT documents where recipient_user_id = userId, channel = in_app, read_at is null
   * 2. RETURN count
   */
  async countUnreadByUserId(userId: string): Promise<number> {
    return NotificationModel.countDocuments({
      recipient_user_id: userId,
      channel: "in_app",
      read_at: null,
    });
  }
}

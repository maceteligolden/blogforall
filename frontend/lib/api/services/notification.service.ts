import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import type {
  NotificationItem,
  ListNotificationsResponse,
  UnreadCountResponse,
} from "../types/notification.types";

export interface ListNotificationsParams {
  page?: number;
  limit?: number;
  since?: Date;
}

export class NotificationService {
  static async list(params: ListNotificationsParams = {}): Promise<ListNotificationsResponse> {
    const query: Record<string, string | number> = {};
    if (params.page != null) query.page = params.page;
    if (params.limit != null) query.limit = params.limit;
    if (params.since) query.since = params.since.toISOString();
    const response = await apiClient.get<{ data: ListNotificationsResponse }>(
      API_ENDPOINTS.NOTIFICATIONS.LIST,
      { params: Object.keys(query).length ? query : undefined }
    );
    return response.data.data ?? response.data;
  }

  static async getUnreadCount(): Promise<number> {
    const response = await apiClient.get<{ data: UnreadCountResponse }>(
      API_ENDPOINTS.NOTIFICATIONS.UNREAD_COUNT
    );
    return response.data.data?.count ?? 0;
  }

  static async markAsRead(id: string): Promise<NotificationItem> {
    const response = await apiClient.patch<{ data: NotificationItem }>(
      API_ENDPOINTS.NOTIFICATIONS.MARK_READ(id)
    );
    return response.data.data ?? response.data;
  }

  static async markAllAsRead(): Promise<number> {
    const response = await apiClient.patch<{ data: { markedCount: number } }>(
      API_ENDPOINTS.NOTIFICATIONS.MARK_ALL_READ
    );
    return response.data.data?.markedCount ?? 0;
  }
}

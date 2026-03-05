export interface NotificationItem {
  _id: string;
  type: string;
  channel: "email" | "in_app";
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  read_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ListNotificationsResponse {
  data: NotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface UnreadCountResponse {
  count: number;
}

import { NotificationChannel, NotificationStatus } from "../constants/notification.constant";

export interface Notification {
  _id?: string;
  channel: NotificationChannel;
  type: string;
  recipient_user_id?: string;
  recipient_email?: string;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  correlation_id: string;
  created_at: Date;
  updated_at: Date;
  read_at?: Date;
  email_message_id?: string;
  template_key?: string;
  sent_at?: Date;
  failed_at?: Date;
  title?: string;
  body?: string;
}

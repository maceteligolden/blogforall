import { Schema, model } from "mongoose";
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

const notificationSchema = new Schema<Notification>(
  {
    channel: {
      type: String,
      required: true,
      enum: Object.values(NotificationChannel),
      index: true,
      description: "Delivery channel: email or in_app",
    },
    type: {
      type: String,
      required: true,
      index: true,
      description: "Notification type (e.g. site_invitation, comment_on_post)",
    },
    recipient_user_id: {
      type: String,
      required: false,
      index: true,
      description: "User ID for in-app notifications",
    },
    recipient_email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      index: true,
      description: "Recipient email for email channel",
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
      description: "Optional JSON payload for context or deep links",
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(NotificationStatus),
      index: true,
      description: "Current status (pending, sent, read, failed, etc.)",
    },
    correlation_id: {
      type: String,
      required: true,
      index: true,
      description: "Id to trace all notifications from one business event",
    },
    read_at: {
      type: Date,
      required: false,
      description: "When the user read the in-app notification",
    },
    email_message_id: {
      type: String,
      required: false,
      description: "Brevo message ID for email delivery tracking",
    },
    template_key: {
      type: String,
      required: false,
      description: "Email template key used for this notification",
    },
    sent_at: {
      type: Date,
      required: false,
      description: "When the email was sent (email channel)",
    },
    failed_at: {
      type: Date,
      required: false,
      description: "When delivery failed (email channel)",
    },
    title: {
      type: String,
      required: false,
      description: "Display title for in-app notification",
    },
    body: {
      type: String,
      required: false,
      description: "Display body for in-app notification",
    },
    created_at: {
      type: Date,
      default: Date.now,
      description: "Record creation time",
    },
    updated_at: {
      type: Date,
      default: Date.now,
      description: "Last update time",
    },
  },
  { timestamps: false }
);

notificationSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

notificationSchema.index({ recipient_user_id: 1, created_at: -1 });
notificationSchema.index({ recipient_user_id: 1, read_at: 1 });
notificationSchema.index({ correlation_id: 1 });
notificationSchema.index({ status: 1, channel: 1 });

export default model<Notification>("Notification", notificationSchema);

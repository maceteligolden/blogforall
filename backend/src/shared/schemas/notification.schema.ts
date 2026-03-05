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
    },
    type: {
      type: String,
      required: true,
      index: true,
    },
    recipient_user_id: {
      type: String,
      required: false,
      index: true,
    },
    recipient_email: {
      type: String,
      required: false,
      lowercase: true,
      trim: true,
      index: true,
    },
    payload: {
      type: Schema.Types.Mixed,
      default: {},
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(NotificationStatus),
      index: true,
    },
    correlation_id: {
      type: String,
      required: true,
      index: true,
    },
    read_at: {
      type: Date,
      required: false,
    },
    email_message_id: {
      type: String,
      required: false,
    },
    template_key: {
      type: String,
      required: false,
    },
    sent_at: {
      type: Date,
      required: false,
    },
    failed_at: {
      type: Date,
      required: false,
    },
    title: {
      type: String,
      required: false,
    },
    body: {
      type: String,
      required: false,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
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

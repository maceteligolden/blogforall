import { Schema, model, Types } from "mongoose";

export interface WorkspaceApiKey {
  _id?: Types.ObjectId;
  site_id: Types.ObjectId;
  /** User who created the key (audit). */
  user_id: string;
  name: string;
  accessKeyId: string;
  hashedSecret: string;
  /** Encrypted plaintext secret for dashboard display; verification uses hashedSecret. */
  secret_encrypted: string;
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

const workspaceApiKeySchema = new Schema<WorkspaceApiKey>(
  {
    site_id: {
      type: Schema.Types.ObjectId,
      ref: "Site",
      required: true,
      index: true,
    },
    user_id: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    accessKeyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    hashedSecret: {
      type: String,
      required: true,
    },
    secret_encrypted: {
      type: String,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    lastUsed: {
      type: Date,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: false }
);

workspaceApiKeySchema.index({ site_id: 1, accessKeyId: 1 });

export default model<WorkspaceApiKey>("WorkspaceApiKey", workspaceApiKeySchema);

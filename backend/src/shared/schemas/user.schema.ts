import { Schema, model } from "mongoose";
import { UserRole, UserPlan } from "../constants";
import { BaseEntity } from "../interfaces";

export interface User extends BaseEntity {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  role: UserRole;
  plan: UserPlan;
  sessionToken?: string | null;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  apiKeys: Array<{
    name: string;
    accessKeyId: string;
    hashedSecret: string;
    createdAt: Date;
    lastUsed?: Date;
    isActive: boolean;
  }>;
}

const userSchema = new Schema<User>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: true,
    },
    first_name: {
      type: String,
      required: true,
      trim: true,
    },
    last_name: {
      type: String,
      required: true,
      trim: true,
    },
    phone_number: {
      type: String,
      required: false,
      trim: true,
    },
    role: {
      type: String,
      enum: Object.values(UserRole),
      default: UserRole.USER,
    },
    plan: {
      type: String,
      enum: Object.values(UserPlan),
      default: UserPlan.FREE,
    },
    sessionToken: {
      type: String,
      default: null,
    },
    resetPasswordToken: {
      type: String,
    },
    resetPasswordExpires: {
      type: Date,
    },
    apiKeys: [
      {
        name: {
          type: String,
          required: true,
        },
        accessKeyId: {
          type: String,
          required: true,
          index: true,
        },
        hashedSecret: {
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
    ],
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Update updated_at before saving
userSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

export default model<User>("User", userSchema);

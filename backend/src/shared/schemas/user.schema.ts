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
  resetPasswordAttempts?: number;
  stripe_customer_id?: string; // Stripe customer ID for payment processing
  onboarding_completed: boolean; // Whether initial account setup is complete (free plan assigned)
  terms_accepted_at?: Date; // When user accepted terms at signup (audit)
  terms_version?: string; // Terms version accepted (e.g. "2025-01") for audit
  referral_code?: string; // Unique code for inviting others
  referred_by_user_id?: string; // User who referred this account
  workspace_invite_prompt_dismissed_at?: Date; // User skipped the invite-teammates onboarding step
  plan_selection_completed_at?: Date; // User confirmed plan during signup wizard
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
    resetPasswordAttempts: {
      type: Number,
      default: 0,
    },
    stripe_customer_id: {
      type: String,
      index: true,
    },
    onboarding_completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    terms_accepted_at: {
      type: Date,
      required: false,
    },
    terms_version: {
      type: String,
      required: false,
      trim: true,
    },
    referral_code: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    referred_by_user_id: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    workspace_invite_prompt_dismissed_at: {
      type: Date,
      required: false,
    },
    plan_selection_completed_at: {
      type: Date,
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

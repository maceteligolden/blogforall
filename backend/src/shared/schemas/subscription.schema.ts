import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum SubscriptionStatus {
  ACTIVE = "active",
  TRIALING = "trialing",
  PAST_DUE = "past_due",
  CANCELLED = "cancelled",
  FREE = "free",
}

export interface Subscription extends BaseEntity {
  userId: string;
  planId: string;
  pendingPlanId?: string; // Plan that will be active at next billing cycle
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gracePeriodEndsAt?: Date; // 2 weeks after payment failure
  paymentProvider?: string; // 'stripe' | 'paypal' | null
  providerSubscriptionId?: string; // External subscription ID
  cancelAtPeriodEnd: boolean;
}

const subscriptionSchema = new Schema<Subscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    } as any,
    planId: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      required: true,
      index: true,
    } as any,
    pendingPlanId: {
      type: Schema.Types.ObjectId,
      ref: "Plan",
      index: true,
    } as any,
    status: {
      type: String,
      enum: Object.values(SubscriptionStatus),
      required: true,
      default: SubscriptionStatus.FREE,
      index: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    gracePeriodEndsAt: {
      type: Date,
    },
    paymentProvider: {
      type: String,
      enum: ["stripe", "paypal", null],
    },
    providerSubscriptionId: {
      type: String,
      index: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
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

// Compound index for active subscriptions
subscriptionSchema.index({ userId: 1, status: 1 });

// Update updated_at before saving
subscriptionSchema.pre("save", function (next) {
  (this as any).updated_at = new Date();
  next();
});

export const SubscriptionModel = model<Subscription>("Subscription", subscriptionSchema);

import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface Plan extends BaseEntity {
  stripe_price_id?: string; // Unique identifier for the plan in Stripe (optional for free plan)
  name: string; // Name of the plan (e.g., "Starter", "Professional", "Enterprise")
  price: number; // Price of the plan (0 for free)
  currency?: string; // Currency of the price, default is "usd"
  interval?: "month" | "year" | "free"; // Billing interval, default is "month"
  metadata?: Record<string, unknown>; // Additional metadata for the plan
  limits: {
    blogPosts: number; // Number of blog posts allowed
    apiCallsPerMonth: number; // Monthly API call limit
    storageGB: number; // Storage limit in GB
    maxSitesAllowed: number; // Maximum number of sites allowed (-1 for unlimited)
    [key: string]: number; // Allow other limit types
  };
  features: string[]; // Array of feature flags like ["emailSupport", "apiAccess", "prioritySupport"]
  isActive: boolean; // Whether plan is available for selection
}

const planSchema = new Schema<Plan>(
  {
    stripe_price_id: { type: String, index: true },
    name: { type: String, required: true, unique: true },
    price: { type: Number, required: true, default: 0 },
    currency: { type: String, default: "usd" },
    interval: { type: String, enum: ["month", "year", "free"], default: "month" },
    metadata: { type: Schema.Types.Mixed },
    limits: {
      blogPosts: { type: Number, required: true, default: 0 },
      apiCallsPerMonth: { type: Number, required: true, default: 0 },
      storageGB: { type: Number, required: true, default: 0 },
      maxSitesAllowed: { type: Number, required: true, default: 1 },
    },
    features: [{ type: String }],
    isActive: { type: Boolean, default: true, index: true },
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
planSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

export const PlanModel = model<Plan>("Plan", planSchema);

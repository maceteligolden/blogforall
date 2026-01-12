import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface Card extends BaseEntity {
  stripe_card_token: string; // Stripe payment method ID
  last_digits: string; // Last 4 digits of card
  expire_date: string; // Format: "MM/YYYY"
  type: string; // Card brand (visa, mastercard, etc.)
  stripe_customer_id: string; // Stripe customer ID
  is_default: boolean; // Whether this is the default payment method
}

const cardSchema = new Schema<Card>(
  {
    stripe_card_token: {
      type: String,
      required: true,
      index: true,
    },
    last_digits: {
      type: String,
      required: true,
    },
    expire_date: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      required: true,
    },
    stripe_customer_id: {
      type: String,
      required: true,
      index: true,
    },
    is_default: {
      type: Boolean,
      default: false,
      index: true,
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
cardSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

export const CardModel = model<Card>("Card", cardSchema);

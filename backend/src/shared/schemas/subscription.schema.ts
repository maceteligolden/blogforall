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
  pendingPlanId?: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  gracePeriodEndsAt?: Date;
  paymentProvider?: string;
  providerSubscriptionId?: string;
  cancelAtPeriodEnd: boolean;
}

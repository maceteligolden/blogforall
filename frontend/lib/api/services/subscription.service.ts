import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface SubscriptionResponse {
  subscription: {
    _id: string;
    userId: string;
    planId: string;
    pendingPlanId?: string;
    status: "active" | "trialing" | "past_due" | "cancelled" | "free";
    currentPeriodStart: string;
    currentPeriodEnd: string;
    gracePeriodEndsAt?: string;
    cancelAtPeriodEnd: boolean;
  };
  plan: {
    _id: string;
    name: string;
    price: number;
    currency?: string;
    interval: "month" | "year" | "free";
    limits: {
      blogPosts: number;
      apiCallsPerMonth: number;
      storageGB: number;
    };
    features: string[];
  };
}

export interface Plan {
  _id: string;
  name: string;
  price: number;
  currency?: string;
  interval: "month" | "year" | "free";
  limits: {
    blogPosts: number;
    apiCallsPerMonth: number;
    storageGB: number;
  };
  features: string[];
  isActive: boolean;
}

export class SubscriptionService {
  /**
   * Get user subscription details
   */
  static async getSubscription(): Promise<SubscriptionResponse> {
    const response = await apiClient.get<{ data: SubscriptionResponse }>(API_ENDPOINTS.SUBSCRIPTION.GET);
    return response.data.data;
  }

  /**
   * Get all available plans
   */
  static async getPlans(): Promise<Plan[]> {
    const response = await apiClient.get<{ data: Plan[] }>(API_ENDPOINTS.SUBSCRIPTION.PLANS);
    return response.data.data || [];
  }

  /**
   * Change subscription plan
   */
  static async changePlan(planId: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.SUBSCRIPTION.CHANGE_PLAN, { planId });
  }

  /**
   * Cancel subscription
   */
  static async cancelSubscription(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.SUBSCRIPTION.CANCEL);
  }
}

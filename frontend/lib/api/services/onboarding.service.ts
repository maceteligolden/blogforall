import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface OnboardingStatus {
  requiresOnboarding: boolean;
  hasCard: boolean;
  hasPlan: boolean;
}

export class OnboardingService {
  /**
   * Get onboarding status
   */
  static async getStatus(): Promise<OnboardingStatus> {
    const response = await apiClient.get<{ data: OnboardingStatus }>(API_ENDPOINTS.ONBOARDING.STATUS);
    return response.data.data;
  }

  /**
   * Complete onboarding with plan and payment method
   */
  static async complete(planId: string, paymentMethodId: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.ONBOARDING.COMPLETE, {
      planId,
      paymentMethodId,
    });
  }

  /**
   * Skip onboarding and use free plan
   */
  static async skip(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.ONBOARDING.SKIP);
  }
}

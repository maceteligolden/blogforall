import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import type { SignupWizardStatus } from "@/lib/onboarding/signup-wizard";

export interface OnboardingStatus {
  requiresOnboarding: boolean;
  hasCard: boolean;
  hasPlan: boolean;
}

export interface InvitePromptStatus {
  should_show: boolean;
  site_id?: string;
}

export type StrategistStepStatus = "pending" | "in_progress" | "ready" | "failed";

export type StrategistProgressStep = {
  id: "content_strategy" | "default_campaign" | "campaign_topics";
  label: string;
  status: StrategistStepStatus;
  error?: string;
};

export type StrategistProgress = {
  site_id: string;
  steps: StrategistProgressStep[];
  ready: boolean;
  failed: boolean;
};

export async function startStrategistBootstrap(
  siteId: string,
  options?: { force?: boolean }
): Promise<StrategistProgress> {
  const response = await apiClient.post<{ data: StrategistProgress }>(
    API_ENDPOINTS.ONBOARDING.STRATEGIST_BOOTSTRAP,
    options?.force ? { force: true } : {},
    { params: { site_id: siteId } }
  );
  return response.data.data;
}

export class OnboardingService {
  /**
   * Get onboarding status
   */
  static async getStatus(): Promise<OnboardingStatus> {
    const response = await apiClient.get<{ data: OnboardingStatus }>(API_ENDPOINTS.ONBOARDING.STATUS);
    return response.data.data;
  }

  static async getSignupWizardStatus(): Promise<SignupWizardStatus> {
    const response = await apiClient.get<{ data: SignupWizardStatus }>(API_ENDPOINTS.ONBOARDING.SIGNUP_WIZARD);
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

  static async completePlanSelection(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.ONBOARDING.COMPLETE_PLAN_SELECTION);
  }

  static async getInvitePromptStatus(siteId?: string): Promise<InvitePromptStatus> {
    const response = await apiClient.get<{ data: InvitePromptStatus }>(API_ENDPOINTS.ONBOARDING.INVITE_PROMPT, {
      params: siteId ? { site_id: siteId } : undefined,
    });
    return response.data.data;
  }

  static async dismissInvitePrompt(): Promise<void> {
    await apiClient.post(API_ENDPOINTS.ONBOARDING.DISMISS_INVITE_PROMPT);
  }

  static async getSetupProgress(siteId: string): Promise<{
    items: Array<{ id: string; label: string; done: boolean }>;
    percent: number;
    complete: boolean;
  }> {
    const response = await apiClient.get<{
      data: {
        items: Array<{ id: string; label: string; done: boolean }>;
        percent: number;
        complete: boolean;
      };
    }>(API_ENDPOINTS.ONBOARDING.SETUP_PROGRESS, {
      params: { site_id: siteId },
    });
    return response.data.data;
  }

  static async getStrategistProgress(siteId: string): Promise<StrategistProgress> {
    const response = await apiClient.get<{ data: StrategistProgress }>(API_ENDPOINTS.ONBOARDING.STRATEGIST_PROGRESS, {
      params: { site_id: siteId },
    });
    return response.data.data;
  }

  static startStrategistBootstrap = startStrategistBootstrap;

  static retryStrategistProgress = startStrategistBootstrap;

  static async acknowledgeStrategistReady(degraded = false): Promise<SignupWizardStatus> {
    const response = await apiClient.post<{ data: SignupWizardStatus }>(
      API_ENDPOINTS.ONBOARDING.STRATEGIST_READY_ACKNOWLEDGE,
      { degraded }
    );
    return response.data.data;
  }
}

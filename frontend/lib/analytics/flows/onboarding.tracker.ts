import { AnalyticsEvents } from "../events";
import type { OnboardingEventProperties } from "../properties";
import { captureEvent } from "../client";

export const onboardingTracker = {
  started: (props?: OnboardingEventProperties) => captureEvent(AnalyticsEvents.ONBOARDING_STARTED, props),

  stepCompleted: (props: OnboardingEventProperties & { step: string }) =>
    captureEvent(AnalyticsEvents.ONBOARDING_STEP_COMPLETED, props),

  billingCompleted: (props?: OnboardingEventProperties) =>
    captureEvent(AnalyticsEvents.ONBOARDING_BILLING_COMPLETED, props),

  billingSkipped: (props?: OnboardingEventProperties) =>
    captureEvent(AnalyticsEvents.ONBOARDING_BILLING_SKIPPED, props),

  planSelected: (props?: OnboardingEventProperties) => captureEvent(AnalyticsEvents.PLAN_SELECTED, props),

  userOnboardingCompleted: (props?: OnboardingEventProperties) =>
    captureEvent(AnalyticsEvents.USER_ONBOARDING_COMPLETED, props),

  workspaceOnboardingCompleted: (props?: OnboardingEventProperties) =>
    captureEvent(AnalyticsEvents.WORKSPACE_ONBOARDING_COMPLETED, props),

  dropped: (props: OnboardingEventProperties & { last_step: string; last_route: string }) =>
    captureEvent(AnalyticsEvents.ONBOARDING_DROPPED, props),

  invitePromptViewed: (props?: OnboardingEventProperties) => captureEvent(AnalyticsEvents.INVITE_PROMPT_VIEWED, props),

  invitePromptSkipped: (props?: OnboardingEventProperties) =>
    captureEvent(AnalyticsEvents.INVITE_PROMPT_SKIPPED, props),

  setupChecklistOpened: (props?: OnboardingEventProperties & { percent?: number }) =>
    captureEvent(AnalyticsEvents.SETUP_CHECKLIST_OPENED, props),

  setupComplete: (props?: OnboardingEventProperties) => captureEvent(AnalyticsEvents.SETUP_COMPLETE, props),
};

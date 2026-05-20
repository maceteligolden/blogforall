import { AnalyticsEvents } from "../events";
import type { AuthEventProperties } from "../properties";
import { captureEvent } from "../posthog";

export const authTracker = {
  signupStarted: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.SIGNUP_STARTED, props),

  signupCompleted: (props?: AuthEventProperties & { userId?: string }) =>
    captureEvent(AnalyticsEvents.SIGNUP_COMPLETED, props, {
      userId: props?.userId,
    }),

  signupFailed: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.SIGNUP_FAILED, props),

  userSignedUp: (props?: AuthEventProperties & { userId?: string }) =>
    captureEvent(AnalyticsEvents.USER_SIGNED_UP, props, {
      userId: props?.userId,
    }),

  loginStarted: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.LOGIN_STARTED, props),

  loginSuccess: (props?: AuthEventProperties & { userId?: string; planType?: string }) =>
    captureEvent(AnalyticsEvents.LOGIN_SUCCESS, props, {
      userId: props?.userId,
      planType: props?.planType,
    }),

  loginFailed: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.LOGIN_FAILED, props),

  logout: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.LOGOUT, props),

  passwordResetStarted: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.PASSWORD_RESET_STARTED, props),

  passwordResetCompleted: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.PASSWORD_RESET_COMPLETED, props),

  passwordResetFailed: (props?: AuthEventProperties) =>
    captureEvent(AnalyticsEvents.PASSWORD_RESET_FAILED, props),
};

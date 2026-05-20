/** Sentry tag values for critical business flows. */
export const ObservabilityFlow = {
  TOKEN_RESERVATION: "token-reservation",
  TOKEN_RECONCILE: "token-reconcile",
  OPENAI_REQUEST: "openai-request",
  AUTH: "auth",
  BILLING: "billing",
  BLOG_GENERATION: "blog-generation",
} as const;

export type ObservabilityFlowType = (typeof ObservabilityFlow)[keyof typeof ObservabilityFlow];

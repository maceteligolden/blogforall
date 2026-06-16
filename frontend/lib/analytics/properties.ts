/** Base properties attached to every analytics event. */
export interface BaseEventProperties {
  user_id?: string;
  workspace_id?: string | null;
  session_id?: string;
  plan_type?: string;
  environment?: string;
}

export interface AuthEventProperties extends BaseEventProperties {
  method?: "email";
  has_invite?: boolean;
  error_message?: string;
}

export interface OnboardingEventProperties extends BaseEventProperties {
  onboarding_type?: "user_billing" | "workspace_setup";
  step?: string;
  step_index?: number;
  last_step?: string;
  last_route?: string;
  plan_id?: string;
  plan_name?: string;
}

export interface GenerationEventProperties extends BaseEventProperties {
  stage?: "analyze" | "generate" | "review";
  generation_type?: "blog" | "ai-generate";
  prompt_length?: number;
  duration_ms?: number;
  word_count?: number;
  error_code?: string;
  error_message?: string;
  endpoint?: string;
  is_retry?: boolean;
}

export interface WorkspaceEventProperties extends BaseEventProperties {
  workspace_name?: string;
  previous_workspace_id?: string;
}

export interface BillingEventProperties extends BaseEventProperties {
  previous_plan?: string;
  new_plan?: string;
  amount?: number;
}

export interface OrchestratorEventProperties extends BaseEventProperties {
  tool_name?: string;
  decision?: "approved" | "rejected";
  thread_id?: string;
}

export interface ApiFailureProperties extends BaseEventProperties {
  endpoint?: string;
  status?: number;
  method?: string;
  request_id?: string;
  feature?: string;
}

export type EventProperties =
  | BaseEventProperties
  | AuthEventProperties
  | OnboardingEventProperties
  | GenerationEventProperties
  | WorkspaceEventProperties
  | BillingEventProperties
  | OrchestratorEventProperties
  | ApiFailureProperties
  | Record<string, unknown>;

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "authorization",
  "apikey",
  "api_key",
  "secret",
  "prompt",
  "content",
]);

const MAX_STRING_LENGTH = 200;

function sanitizeValue(key: string, value: unknown): unknown {
  if (SENSITIVE_KEYS.has(key.toLowerCase())) {
    if (typeof value === "string") {
      return value.length > 0 ? `[redacted:${value.length} chars]` : "[redacted]";
    }
    return "[redacted]";
  }
  if (typeof value === "string" && value.length > MAX_STRING_LENGTH) {
    return `${value.slice(0, MAX_STRING_LENGTH)}…`;
  }
  return value;
}

/** Strip sensitive fields before sending to PostHog. */
export function sanitizeEventProperties(
  props: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null) continue;
    if (typeof value === "object" && !Array.isArray(value) && value !== null) {
      out[key] = sanitizeEventProperties(value as Record<string, unknown>);
    } else {
      out[key] = sanitizeValue(key, value);
    }
  }
  return out;
}

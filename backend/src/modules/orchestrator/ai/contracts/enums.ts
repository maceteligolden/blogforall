import { z } from "zod";

export const workflowModeSchema = z.enum(["chat", "quick_draft", "strategist_pipeline", "onboarding"]);

export const workflowStageSchema = z.enum([
  "idle",
  "clarify",
  "strategy",
  "research",
  "outline",
  "write",
  "optimize",
  "improve",
  "publish",
  "done",
]);

export const intentSchema = z.enum([
  "create_content",
  "update_content",
  "optimize_content",
  "review_content",
  "publish_content",
  "schedule_content",
  "unpublish_content",
  "delete_content",
  "list_content",
  "get_content",
  "explain",
  "strategy",
  "research",
  "analytics",
  "update_memory",
  "onboarding",
  "casual",
  "unknown",
]);

export const skillIdSchema = z.enum([
  "conversation",
  "content_strategy",
  "research",
  "writing",
  "content_optimization",
  "publishing",
  "analytics",
]);

export type WorkflowMode = z.infer<typeof workflowModeSchema>;
export type WorkflowStage = z.infer<typeof workflowStageSchema>;
export type Intent = z.infer<typeof intentSchema>;
export type SkillId = z.infer<typeof skillIdSchema>;

/** Map legacy review_content → optimize_content (docs 05). */
export function normalizeIntent(intent: Intent): Exclude<Intent, "review_content"> {
  if (intent === "review_content") return "optimize_content";
  return intent;
}

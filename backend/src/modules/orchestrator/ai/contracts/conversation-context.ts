import { z } from "zod";
import { dialogueSlotsSchema } from "./dialogue-slots";
import { intentSchema } from "./enums";

export const communicativeCategorySchema = z.enum([
  "ask_information",
  "request_action",
  "brainstorm",
  "provide_feedback",
  "update_preferences",
  "casual",
  "unknown",
]);

export const conversationModeSchema = z.enum([
  "information",
  "creation",
  "planning",
  "editing",
  "feedback",
  "casual",
]);

export const suggestedNextActionSchema = z.enum([
  "explain",
  "start_content_workflow",
  "start_planning",
  "revise_current_artifact",
  "emit_memory_candidate",
  "casual_reply",
  "clarify",
]);

export const conversationEntitySchema = z.object({
  type: z.enum(["topic", "blog_id", "url", "audience", "channel", "other"]),
  value: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const responseStyleSchema = z.object({
  brevity: z.enum(["short", "normal", "detailed"]),
  formality: z.enum(["casual", "neutral", "formal"]),
  initiative: z.enum(["passive", "suggest", "lead"]),
});

export const conversationContextSchema = z.object({
  communicative_category: communicativeCategorySchema,
  workflow_intent: intentSchema,
  confidence: z.number().min(0).max(1),
  action_required: z.boolean(),
  conversation_mode: conversationModeSchema,
  emotional_state: z.string().optional(),
  humor_detected: z.boolean(),
  tone_preference: z.enum(["casual", "professional", "technical", "friendly"]),
  urgency: z.enum(["low", "normal", "high"]).optional(),
  entities: z.array(conversationEntitySchema).default([]),
  references_previous_context: z.boolean(),
  requires_clarification: z.boolean(),
  clarification_question: z.string().optional(),
  suggested_next_action: suggestedNextActionSchema,
  response_style: responseStyleSchema,
  slots_patch: dialogueSlotsSchema.partial().default({}),
  literal_interpretation: z.string().optional(),
  communicative_rationale: z.string().optional(),
});

export type ConversationContext = z.infer<typeof conversationContextSchema>;
export type CommunicativeCategory = z.infer<typeof communicativeCategorySchema>;
export type SuggestedNextAction = z.infer<typeof suggestedNextActionSchema>;

import { z } from "zod";

export const memoryLayerSchema = z.enum([
  "session",
  "workspace",
  "user_preference",
  "knowledge",
  "learning",
  "content_intelligence",
  "temporary",
]);

export const cognitiveKindSchema = z.enum(["semantic", "episodic", "procedural"]);

export const memoryCandidateSchema = z.object({
  id: z.string().optional(),
  turn_id: z.string().min(1),
  workspace_id: z.string().min(1),
  user_id: z.string().optional(),
  text: z.string().optional(),
  proposed_key: z.string().optional(),
  proposed_value: z.unknown().optional(),
  proposed_layer: z.union([memoryLayerSchema, z.literal("discard")]).optional(),
  confidence: z.number().min(0).max(1).optional(),
  source: z.enum(["user_utterance", "tool_result", "skill_artifact", "system"]),
});

export const memoryImportanceScoreSchema = z.object({
  score: z.number().min(0).max(1),
  factors: z.record(z.number()),
  threshold: z.number().min(0).max(1),
  pass: z.boolean(),
});

export const memoryConflictResolutionSchema = z.object({
  action: z.enum(["create", "update", "merge", "supersede", "ignore"]),
  prior_id: z.string().optional(),
  rationale: z.string().min(1),
});

export const beliefStatusSchema = z.enum(["new", "confirmed", "updated", "invalidated"]);

export const memoryMetadataSchema = z.object({
  created_at: z.string().min(1),
  updated_at: z.string().min(1),
  confidence: z.number().min(0).max(1),
  importance: z.number().min(0).max(1),
  cognitive_kind: cognitiveKindSchema.optional(),
  superseded_by: z.string().optional(),
  soft_deleted: z.boolean().optional(),
  source_turn_id: z.string().optional(),
  /** Knowledge source (doc 21): onboarding | conversation | user_explicit | analytics | … */
  source: z.string().optional(),
  /** Belief lifecycle status (doc 21). */
  belief_status: beliefStatusSchema.optional(),
  version: z.number().int().positive(),
});

export const memoryRecordSchema = z.object({
  id: z.string().min(1),
  workspace_id: z.string().min(1),
  user_id: z.string().nullable().optional(),
  layer: memoryLayerSchema,
  canonical_key: z.string().min(1),
  value: z.unknown(),
  value_text: z.string().optional(),
  metadata: memoryMetadataSchema,
});

export const conversationSummarySchema = z.object({
  id: z.string().min(1),
  thread_id: z.string().min(1),
  workspace_id: z.string().min(1),
  summary_text: z.string().min(1),
  covered_message_ids: z.array(z.string()),
  created_at: z.string().min(1),
});

export const rememberResultSchema = z.object({
  status: z.enum(["stored", "updated", "merged", "ignored", "enqueued", "discarded"]),
  record_id: z.string().optional(),
  job_id: z.string().optional(),
  resolution: memoryConflictResolutionSchema.optional(),
});

export type MemoryLayer = z.infer<typeof memoryLayerSchema>;
export type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
export type MemoryRecord = z.infer<typeof memoryRecordSchema>;
export type RememberResult = z.infer<typeof rememberResultSchema>;

/** Importance gate used by evaluation pipeline (threshold configurable per layer later). */
export function passesImportance(score: number, threshold: number): boolean {
  return score >= threshold;
}

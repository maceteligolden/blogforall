import { z } from "zod";

const baseMemorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  siteId: z.string(),

  content: z.string(),

  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),

  importance: z.number().min(0).max(1).optional(),

  source: z
    .object({
      type: z.string(),
      id: z.string().optional(),
    })
    .optional(),
});

export const semanticMemorySchema = baseMemorySchema.extend({
  type: z.literal("semantic"),

  category: z.enum(["identity", "business", "preference", "fact", "goal"]).optional(),
});

export const episodicMemorySchema = baseMemorySchema.extend({
  type: z.literal("episodic"),

  eventType: z.enum(["interaction", "decision", "feedback", "success", "failure", "milestone"]).optional(),

  occurredAt: z.coerce.date(),
});

export const proceduralMemorySchema = baseMemorySchema.extend({
  type: z.literal("procedural"),

  category: z.enum(["preference", "instruction", "workflow", "constraint", "behavior"]).optional(),
});

export const longTermMemorySchema = z.discriminatedUnion("type", [
  semanticMemorySchema,
  episodicMemorySchema,
  proceduralMemorySchema,
]);

export type LongTermMemory = z.infer<typeof longTermMemorySchema>;

const skillSchema = z.object({
  name: z.string(),
  description: z.string(),
  content: z.string(),
  /** Tools owned by this skill; unlocked only after load_skill. */
  toolNames: z.array(z.string()),
});

const semanticCandidateSchema = z.object({
  type: z.literal("semantic"),
  content: z.string(),
  category: z.enum(["identity", "business", "preference", "fact", "goal"]),
  importance: z.number().min(0).max(1),
});

const episodicCandidateSchema = z.object({
  type: z.literal("episodic"),
  content: z.string(),
  eventType: z.enum(["interaction", "decision", "feedback", "success", "failure", "milestone"]),
  importance: z.number().min(0).max(1),
});

const proceduralCandidateSchema = z.object({
  type: z.literal("procedural"),
  content: z.string(),
  category: z.enum(["preference", "instruction", "workflow", "constraint", "behavior"]),
  importance: z.number().min(0).max(1),
});

const memoryCandidateSchema = z.discriminatedUnion("type", [
  semanticCandidateSchema,
  episodicCandidateSchema,
  proceduralCandidateSchema,
]);

const memoryMutationSchema = z.object({
  mutations: z.array(
    z.discriminatedUnion("action", [
      z.object({
        action: z.literal("add"),
        memory: memoryCandidateSchema,
      }),
      z.object({
        action: z.literal("update"),
        id: z.string(),
        // OpenAI structured outputs require nullable instead of optional
        content: z.string().nullable(),
        importance: z.number().min(0).max(1).nullable(),
        category: z
          .enum([
            "identity",
            "business",
            "preference",
            "fact",
            "goal",
            "instruction",
            "workflow",
            "constraint",
            "behavior",
          ])
          .nullable(),
        eventType: z.enum(["interaction", "decision", "feedback", "success", "failure", "milestone"]).nullable(),
      }),
      z.object({
        action: z.literal("forget"),
        id: z.string(),
        reason: z.string().nullable(),
      }),
    ])
  ),
});

type MemoryMutationResult = z.infer<typeof memoryMutationSchema>;
type MemoryCandidate = z.infer<typeof memoryCandidateSchema>;
type Skill = z.infer<typeof skillSchema>;

export { Skill, skillSchema, MemoryCandidate, memoryCandidateSchema, MemoryMutationResult, memoryMutationSchema };

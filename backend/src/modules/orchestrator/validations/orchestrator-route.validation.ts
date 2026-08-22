import { z } from "zod";

export const siteIdParamSchema = z.object({
  siteId: z.string().min(1, "Site ID is required"),
});

export const threadIdParamSchema = z.object({
  siteId: z.string().min(1),
  threadId: z.string().min(1),
});

export const approvalIdParamSchema = z.object({
  siteId: z.string().min(1),
  approvalId: z.string().min(1),
});

/**
 * Body for POST /sites/:siteId/orchestrator/chat.
 * - `thread_id` optional: when omitted, a new thread is created.
 * - `message` is the user's natural-language input.
 */
const optionalFocusString = (max: number) =>
  z.preprocess((value) => (value == null || value === "" ? undefined : value), z.string().min(1).max(max).optional());

export const threadFocusSchema = z
  .object({
    campaign_id: optionalFocusString(128),
    roadmap_sequence_index: z.preprocess(
      (value) => (value == null ? undefined : value),
      z.number().int().min(0).optional()
    ),
    blog_id: optionalFocusString(128),
    topic: optionalFocusString(400),
    intent: optionalFocusString(2000),
  })
  .optional();

export const orchestratorChatBodySchema = z.object({
  thread_id: z.string().min(1).optional(),
  message: z.string().min(1).max(8000),
  session_mode: z.enum(["auto", "planning", "writing", "research", "review", "casual", "strategy"]).optional(),
  conversation_mode: z.boolean().optional(),
  focus: threadFocusSchema,
  selection_context: z
    .object({
      blog_id: z.string().min(1),
      reference_type: z.enum(["highlight", "blog"]).default("highlight"),
      text: z.string().max(4000).optional(),
    })
    .refine((v) => v.reference_type === "blog" || (v.text?.trim().length ?? 0) > 0, {
      message: "text required for highlight references",
    })
    .optional(),
  attachments: z
    .array(
      z.object({
        name: z.string().min(1).max(256),
        url: z.string().url(),
        mime_type: z.string().min(1).max(128),
        extracted_text: z.string().max(8000).optional(),
      })
    )
    .max(10)
    .optional(),
});

/**
 * Body for POST /sites/:siteId/orchestrator/onboarding/chat. Onboarding chats
 * are gated to a single active thread per workspace; the backend will pick
 * (or create) the canonical onboarding thread regardless of `thread_id`.
 */
export const orchestratorOnboardingChatBodySchema = z.object({
  message: z.string().min(1).max(8000),
});

/** Body for POST /sites/:siteId/orchestrator/threads/open — optional resume. */
export const openThreadBodySchema = z
  .object({
    thread_id: z.string().min(1).optional(),
  })
  .default({});

/** Body for POST /sites/:siteId/orchestrator/voice/tts */
export const voiceTtsBodySchema = z.object({
  text: z.string().min(1).max(2500),
});

export const orchestratorApprovalDecisionBodySchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  note: z.string().max(4000).optional(),
});

export const threadListQuerySchema = z.object({
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => parseInt(s, 10))
    .optional(),
  include_archived: z
    .union([z.literal("true"), z.literal("false")])
    .transform((s) => s === "true")
    .optional(),
  entity_type: z.enum(["strategy", "campaign", "blog"]).optional(),
  entity_id: z.string().min(1).optional(),
  q: z.string().max(120).optional(),
  cursor: z.string().min(1).optional(),
});

export const threadAssociationSchema = z.object({
  entity_type: z.enum(["strategy", "campaign", "blog"]),
  entity_id: z.string().min(1),
});

export const createThreadBodySchema = z.object({
  channel: z.enum(["chat", "call"]).optional(),
  associations: z.array(threadAssociationSchema).max(20).optional(),
  focus: threadFocusSchema,
});

export const renameThreadBodySchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(120, "Title must be at most 120 characters").optional(),
    associations: z.array(threadAssociationSchema).max(20).optional(),
  })
  .refine((v) => Boolean(v.title || v.associations?.length), {
    message: "title or associations is required",
  });

export const knowledgeSourceIdParamSchema = z.object({
  siteId: z.string().min(1),
  id: z.string().min(1),
});

export const approvalListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "executed", "expired"]).optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => parseInt(s, 10))
    .optional(),
});

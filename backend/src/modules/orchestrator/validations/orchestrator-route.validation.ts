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
export const orchestratorChatBodySchema = z.object({
  thread_id: z.string().min(1).optional(),
  message: z.string().min(1).max(8000),
  session_mode: z.enum(["auto", "planning", "writing", "research", "review", "casual", "strategy"]).optional(),
  conversation_mode: z.boolean().optional(),
  focus: z
    .object({
      campaign_id: z.string().min(1).optional(),
      roadmap_sequence_index: z.number().int().min(0).optional(),
      blog_id: z.string().min(1).optional(),
      topic: z.string().min(1).max(400).optional(),
      intent: z.string().max(2000).optional(),
    })
    .optional(),
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
});

export const renameThreadBodySchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title must be at most 120 characters"),
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

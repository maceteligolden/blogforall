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
});

/**
 * Body for POST /sites/:siteId/orchestrator/onboarding/chat. Onboarding chats
 * are gated to a single active thread per workspace; the backend will pick
 * (or create) the canonical onboarding thread regardless of `thread_id`.
 */
export const orchestratorOnboardingChatBodySchema = z.object({
  message: z.string().min(1).max(8000),
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

export const approvalListQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "executed", "expired"]).optional(),
  limit: z
    .string()
    .regex(/^\d+$/)
    .transform((s) => parseInt(s, 10))
    .optional(),
});

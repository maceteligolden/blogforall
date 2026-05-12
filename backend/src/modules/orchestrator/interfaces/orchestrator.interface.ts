import { z } from "zod";
import {
  OrchestratorApprovalKind,
  type OrchestratorApproval,
} from "../../../shared/schemas/orchestrator-approval.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorThread } from "../../../shared/schemas/orchestrator-thread.schema";
import type { WorkspaceMemory } from "../../../shared/schemas/workspace-memory.schema";

/**
 * What the supervisor decided to do this turn. Returned by the `route` node
 * as structured output. The graph dispatches on `next` and uses the rest of
 * the fields to drive the corresponding side-effect node.
 */
/**
 * NOTE on schema compatibility with OpenAI structured-outputs (Responses API):
 *  1. Every JSON-schema property MUST be `required`; optionality is expressed
 *     via `null` only. So non-mandatory fields below use `.nullable()` rather
 *     than `.optional()` (the SDK rejects `.optional()` at convert time).
 *  2. Open-ended object maps (`z.record(z.string(), z.unknown())`) are NOT
 *     supported — they emit `additionalProperties` without a concrete `type`,
 *     which OpenAI rejects at request time. The fields whose shape varies per
 *     tool / memory area are modeled as JSON-encoded **strings** that the
 *     server parses into `Record<string, unknown>` via `parseSupervisorDecisionFromRaw`.
 *
 * `supervisorDecisionRawSchema` is what the LLM emits and what we hand to
 * `withStructuredOutput`. `SupervisorDecision` (below) is the shape the rest
 * of the codebase consumes — the variable-shape blobs are already parsed.
 */
export const supervisorDecisionRawSchema = z.object({
  /** Free-form chain-of-reasoning. Not surfaced to the user; useful for logs. */
  reasoning: z.string().max(2000).nullable(),
  next: z.enum([
    "respond",
    "call_tool",
    "request_confirmation",
    "resolve_confirmation",
    "update_memory",
    "complete_onboarding",
    "end",
  ]),
  reply: z.string().max(8000).nullable(),
  tool: z
    .object({
      name: z.string().min(1),
      /** JSON-encoded object string. Server parses into Record<string, unknown>. */
      input_json: z.string(),
    })
    .nullable(),
  confirmation: z
    .object({
      action: z.string().min(1),
      /** JSON-encoded payload (variable shape per tool). */
      payload_json: z.string(),
      summary: z.string().min(1).max(2000),
      kind: z.nativeEnum(OrchestratorApprovalKind),
    })
    .nullable(),
  confirmation_decision: z
    .object({
      approval_id: z.string().min(1),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(4000).nullable(),
    })
    .nullable(),
  /** JSON-encoded patch for WorkspaceMemory (only includes changing fields). */
  memory_patch_json: z.string().nullable(),
  /** JSON-encoded payload for `workspace.completeOnboarding`. */
  onboarding_payload_json: z.string().nullable(),
});

export type SupervisorDecisionRaw = z.infer<typeof supervisorDecisionRawSchema>;

/**
 * Decoded, consumer-facing shape. Variable-shape blobs are already parsed
 * back to `Record<string, unknown>`. Service-layer code uses this type only.
 */
export interface SupervisorDecision {
  reasoning: string | null;
  next:
    | "respond"
    | "call_tool"
    | "request_confirmation"
    | "resolve_confirmation"
    | "update_memory"
    | "complete_onboarding"
    | "end";
  reply: string | null;
  tool: {
    name: string;
    input: Record<string, unknown>;
  } | null;
  confirmation: {
    action: string;
    payload: Record<string, unknown>;
    summary: string;
    kind: OrchestratorApprovalKind;
  } | null;
  confirmation_decision: {
    approval_id: string;
    decision: "approved" | "rejected";
    note: string | null;
  } | null;
  memory_patch: Record<string, unknown> | null;
  onboarding_payload: Record<string, unknown> | null;
}

/**
 * Safely parse a JSON object string. Returns `{}` on any error so the
 * caller can keep going (an empty payload is always safer than throwing
 * mid-turn over a malformed model emission).
 */
function safeParseObject(s: string | null | undefined): Record<string, unknown> {
  if (!s || typeof s !== "string") return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function safeParseObjectOrNull(s: string | null | undefined): Record<string, unknown> | null {
  if (s === null || s === undefined || s === "") return null;
  return safeParseObject(s);
}

/**
 * Translate the raw LLM emission into the consumer-facing SupervisorDecision,
 * decoding the four JSON-encoded variable-shape fields.
 */
export function parseSupervisorDecisionFromRaw(raw: SupervisorDecisionRaw): SupervisorDecision {
  return {
    reasoning: raw.reasoning,
    next: raw.next,
    reply: raw.reply,
    tool: raw.tool
      ? { name: raw.tool.name, input: safeParseObject(raw.tool.input_json) }
      : null,
    confirmation: raw.confirmation
      ? {
          action: raw.confirmation.action,
          payload: safeParseObject(raw.confirmation.payload_json),
          summary: raw.confirmation.summary,
          kind: raw.confirmation.kind,
        }
      : null,
    confirmation_decision: raw.confirmation_decision
      ? {
          approval_id: raw.confirmation_decision.approval_id,
          decision: raw.confirmation_decision.decision,
          note: raw.confirmation_decision.note,
        }
      : null,
    memory_patch: safeParseObjectOrNull(raw.memory_patch_json),
    onboarding_payload: safeParseObjectOrNull(raw.onboarding_payload_json),
  };
}

/**
 * The shape every orchestrator tool must conform to. Tools are thin adapters
 * over existing services; they receive `siteId` and `userId` from the
 * supervisor's request context (not from the LLM) to enforce tenant isolation.
 */
export interface OrchestratorToolInvocation {
  siteId: string;
  userId: string;
  threadId: string;
  /** Raw input the LLM produced. Tool MUST validate before use. */
  input: Record<string, unknown>;
}

export interface OrchestratorToolResult {
  /** Short, model-friendly summary appended to the tool message content. */
  summary: string;
  /** Optional structured payload returned to the supervisor for follow-up. */
  data?: unknown;
}

export interface OrchestratorTool {
  /** Unique identifier (e.g. "blogs.list"). */
  name: string;
  /** Short description shown to the supervisor when listing available tools. */
  description: string;
  /** If true, the tool is destructive and the supervisor MUST gate it. */
  requiresConfirmation: boolean;
  /** Confirmation kind used when raising approval. */
  confirmationKind?: OrchestratorApprovalKind;
  /** Run the tool. Errors should be thrown; the graph normalizes them. */
  run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult>;
}

/**
 * What the controller returns to the frontend after one chat turn. The panel
 * renders `assistant_message`, badges each `tool_call`, and prompts the user
 * to decide on `pending_approval` if present.
 */
export interface ChatTurnResponse {
  thread_id: string;
  assistant_message: {
    id: string;
    content: string;
    created_at: Date;
  };
  tool_calls: Array<{
    tool: string;
    summary: string;
  }>;
  pending_approval: SerializedApproval | null;
  workspace_status: "onboarding" | "active";
  /** True when the supervisor flipped Site.status during this turn. */
  onboarding_completed: boolean;
}

export interface SerializedApproval {
  id: string;
  kind: OrchestratorApprovalKind;
  action: string;
  summary: string;
  status: "pending" | "approved" | "rejected" | "executed" | "expired";
  requested_at: Date;
}

export function serializeApproval(approval: OrchestratorApproval): SerializedApproval {
  return {
    id: approval._id!.toString(),
    kind: approval.kind,
    action: approval.action,
    summary: approval.summary,
    status: approval.status,
    requested_at: approval.requested_at,
  };
}

/**
 * Snapshot of everything the supervisor needs to reason about this turn.
 * Loaded by the graph's `loadContext` node and threaded through state.
 */
export interface OrchestratorContextSnapshot {
  thread: OrchestratorThread;
  history: OrchestratorMessage[];
  memory: WorkspaceMemory;
  workspace_name: string;
  pending_approval: OrchestratorApproval | null;
}

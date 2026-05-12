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
export const supervisorDecisionSchema = z.object({
  /** Free-form chain-of-reasoning. Not surfaced to the user; useful for logs. */
  reasoning: z.string().max(2000).optional(),
  /**
   * Next action:
   *  - `respond`              : just write a natural-language reply to the user.
   *  - `call_tool`            : invoke `tool.name` with `tool.input`.
   *  - `request_confirmation` : pose a yes/no question, persist an approval.
   *  - `resolve_confirmation` : the latest user turn answered a pending approval.
   *  - `update_memory`        : write `memory_patch` to WorkspaceMemory.
   *  - `complete_onboarding`  : flip Site.status to active and end the thread.
   *  - `end`                  : terminate the turn without further work.
   */
  next: z.enum([
    "respond",
    "call_tool",
    "request_confirmation",
    "resolve_confirmation",
    "update_memory",
    "complete_onboarding",
    "end",
  ]),
  /** Final assistant message to surface to the user this turn. */
  reply: z.string().max(8000).optional(),
  /** Tool to invoke when `next == "call_tool"`. */
  tool: z
    .object({
      name: z.string().min(1),
      input: z.record(z.string(), z.unknown()).default({}),
    })
    .optional(),
  /** Used when `next == "request_confirmation"`. */
  confirmation: z
    .object({
      /** Tool the confirmation would unlock. */
      action: z.string().min(1),
      /** Original tool input we'll re-run once approved. */
      payload: z.record(z.string(), z.unknown()).default({}),
      /** Short human-readable summary of what will happen. */
      summary: z.string().min(1).max(2000),
      kind: z.nativeEnum(OrchestratorApprovalKind),
    })
    .optional(),
  /** True if user's latest message resolved a pending approval. */
  confirmation_decision: z
    .object({
      approval_id: z.string().min(1),
      decision: z.enum(["approved", "rejected"]),
      note: z.string().max(4000).optional(),
    })
    .optional(),
  /** When `next == "update_memory"`. Only patch what is actually changing. */
  memory_patch: z.record(z.string(), z.unknown()).optional(),
  /** When `next == "complete_onboarding"` — full payload to seed memory with. */
  onboarding_payload: z.record(z.string(), z.unknown()).optional(),
});

export type SupervisorDecision = z.infer<typeof supervisorDecisionSchema>;

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

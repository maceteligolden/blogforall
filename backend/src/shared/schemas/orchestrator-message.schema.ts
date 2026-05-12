import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export enum OrchestratorMessageRole {
  USER = "user",
  ASSISTANT = "assistant",
  TOOL = "tool",
  SYSTEM = "system",
}

/**
 * Persisted record of a tool invocation captured alongside an assistant turn.
 * Stored on the assistant message so the panel can render collapsed badges.
 */
export interface OrchestratorToolCallRecord {
  tool: string;
  input: Record<string, unknown>;
  output_summary?: string;
  output_data?: unknown;
  /** Approval that gated this tool, when applicable. */
  approval_id?: string;
  /** True if the tool returned an error; assistant should surface it. */
  errored?: boolean;
  error_message?: string;
}

/**
 * A single message in an OrchestratorThread. We persist user, assistant,
 * tool, and system messages so the supervisor can rebuild the conversation
 * on every turn without relying on in-memory state.
 */
export interface OrchestratorMessage extends BaseEntity {
  thread_id: string;
  /** Denormalized for tenant-scoped queries without a join. */
  site_id: string;
  role: OrchestratorMessageRole;
  content: string;
  /** Tool call records, populated only on assistant messages that ran tools. */
  tool_calls?: OrchestratorToolCallRecord[];
  /**
   * For tool messages: the tool name that produced this content (mirrors the
   * tool_call_id pattern from OpenAI). Optional for user/assistant/system.
   */
  tool_name?: string;
  /**
   * When the assistant message ends with a pending in-chat confirmation,
   * we link the approval row so the next user turn can resolve it.
   */
  pending_approval_id?: string;
  created_at: Date;
  updated_at: Date;
}

const orchestratorMessageSchema = new Schema<OrchestratorMessage>(
  {
    thread_id: { type: String, required: true, index: true },
    site_id: { type: String, required: true, index: true },
    role: { type: String, enum: Object.values(OrchestratorMessageRole), required: true },
    content: { type: String, required: true, default: "" },
    tool_calls: {
      type: [
        {
          tool: { type: String, required: true },
          input: { type: Schema.Types.Mixed, default: {} },
          output_summary: { type: String },
          output_data: { type: Schema.Types.Mixed },
          approval_id: { type: String },
          errored: { type: Boolean, default: false },
          error_message: { type: String },
        },
      ],
      default: undefined,
    },
    tool_name: { type: String },
    pending_approval_id: { type: String, index: true },
    created_at: { type: Date, default: Date.now, index: true },
    updated_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

orchestratorMessageSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

orchestratorMessageSchema.index({ thread_id: 1, created_at: 1 });
orchestratorMessageSchema.index({ site_id: 1, role: 1, created_at: -1 });

export default model<OrchestratorMessage>("OrchestratorMessage", orchestratorMessageSchema);

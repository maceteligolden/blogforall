import { Schema, model } from "mongoose";
import { env } from "../config/env";

export type OrchestratorLongTermMemoryType =
  | "semantic"
  | "episodic"
  | "procedural";

export interface OrchestratorLongTermMemoryDoc {
  id: string;
  userId: string;
  siteId: string;
  type: OrchestratorLongTermMemoryType;
  content: string;
  importance?: number;
  category?: string;
  eventType?: string;
  occurredAt?: Date;
  source?: {
    type: string;
    id?: string;
  };
  embedding_model: string;
  embedding?: number[];
  createdAt: Date;
  updatedAt: Date;
}

const orchestratorLongTermMemorySchema = new Schema<OrchestratorLongTermMemoryDoc>(
  {
    id: { type: String, required: true, unique: true, index: true },
    userId: { type: String, required: true, index: true },
    siteId: { type: String, required: true, index: true },
    type: {
      type: String,
      required: true,
      enum: ["semantic", "episodic", "procedural"],
    },
    content: { type: String, required: true },
    importance: { type: Number, min: 0, max: 1 },
    category: { type: String },
    eventType: { type: String },
    occurredAt: { type: Date },
    source: {
      type: {
        type: String,
        required: true,
      },
      id: { type: String },
    },
    embedding_model: {
      type: String,
      default: () => env.memory.embeddingModel,
    },
    embedding: { type: [Number], select: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: "orchestrator_longterm_memories",
  },
);

orchestratorLongTermMemorySchema.index({ siteId: 1, userId: 1 });
orchestratorLongTermMemorySchema.index({ siteId: 1, userId: 1, type: 1 });

export default model<OrchestratorLongTermMemoryDoc>(
  "OrchestratorLongTermMemory",
  orchestratorLongTermMemorySchema,
);

import { Schema, model } from "mongoose";
import type { MemoryChunkSourceType } from "./memory-types";

export interface MemoryChunkMeta {
  site_id: string;
  chunk_id: string;
  source_type: MemoryChunkSourceType;
  source_id: string;
  text_preview: string;
  text_full: string;
  embedding_model: string;
  /** Stored inline when vector DB unavailable; used for cosine similarity fallback. */
  embedding?: number[];
  importance_score: number;
  created_at: Date;
  expires_at?: Date;
}

const memoryChunkMetaSchema = new Schema<MemoryChunkMeta>(
  {
    site_id: { type: String, required: true, index: true },
    chunk_id: { type: String, required: true, unique: true, index: true },
    source_type: { type: String, required: true, index: true },
    source_id: { type: String, required: true },
    text_preview: { type: String, maxlength: 500 },
    text_full: { type: String, maxlength: 8000 },
    embedding_model: { type: String, default: "text-embedding-3-small" },
    embedding: { type: [Number], select: false },
    importance_score: { type: Number, default: 0.5, min: 0, max: 1 },
    created_at: { type: Date, default: Date.now },
    expires_at: { type: Date, index: true },
  },
  { timestamps: false }
);

memoryChunkMetaSchema.index({ site_id: 1, source_type: 1, importance_score: -1 });

export default model<MemoryChunkMeta>("MemoryChunkMeta", memoryChunkMetaSchema);

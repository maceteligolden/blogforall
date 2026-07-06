import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface KnowledgeChunk extends BaseEntity {
  site_id: string;
  source_id: string;
  chunk_index: number;
  text: string;
  token_count: number;
  vector_id?: string;
  embedding?: number[];
  created_at: Date;
}

const knowledgeChunkSchema = new Schema<KnowledgeChunk>(
  {
    site_id: { type: String, required: true, index: true },
    source_id: { type: String, required: true, index: true },
    chunk_index: { type: Number, required: true },
    text: { type: String, required: true, maxlength: 4000 },
    token_count: { type: Number, default: 0 },
    vector_id: { type: String },
    embedding: { type: [Number], select: false },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

knowledgeChunkSchema.index({ site_id: 1, source_id: 1, chunk_index: 1 }, { unique: true });

export default model<KnowledgeChunk>("KnowledgeChunk", knowledgeChunkSchema);

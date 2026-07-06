import { Schema, model } from "mongoose";
import { BaseEntity } from "../interfaces";

export interface EpisodicEpisode extends BaseEntity {
  site_id: string;
  period_start: Date;
  period_end: Date;
  summary: string;
  key_decisions: string[];
  content_produced: string[];
  open_threads: string[];
  created_at: Date;
}

const episodicEpisodeSchema = new Schema<EpisodicEpisode>(
  {
    site_id: { type: String, required: true, index: true },
    period_start: { type: Date, required: true },
    period_end: { type: Date, required: true },
    summary: { type: String, default: "", maxlength: 8000 },
    key_decisions: { type: [String], default: [] },
    content_produced: { type: [String], default: [] },
    open_threads: { type: [String], default: [] },
    created_at: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

episodicEpisodeSchema.index({ site_id: 1, period_end: -1 });

export default model<EpisodicEpisode>("EpisodicEpisode", episodicEpisodeSchema);

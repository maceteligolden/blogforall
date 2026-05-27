import { Schema, model } from "mongoose";
import { CampaignHealthStatus, CampaignLifecycleStatus } from "../constants/campaign.constant";
import { BaseEntity } from "../interfaces";

export interface CampaignProgressReport extends BaseEntity {
  campaign_id: string;
  site_id: string;
  report_date: string;
  period_label: string;
  lifecycle_status: CampaignLifecycleStatus;
  health_status: CampaignHealthStatus;
  health_reasons: string[];
  progress: {
    total_planned: number;
    published: number;
    scheduled_upcoming: number;
    awaiting_approval: number;
    failed: number;
    skipped: number;
    percent_complete: number;
    days_elapsed: number;
    days_remaining: number;
  };
  highlights: string[];
  risks: string[];
  recommendations: string[];
  narrative_summary: string;
  upcoming_7d: Array<{ title: string; scheduled_at: string; status: string }>;
  pending_approvals: Array<{ title: string; due_at: string; scheduled_post_id?: string }>;
  generated_at: Date;
  emailed_at?: Date;
  email_recipient_ids?: string[];
}

const campaignProgressReportSchema = new Schema<CampaignProgressReport>(
  {
    campaign_id: { type: String, required: true, index: true },
    site_id: { type: String, required: true, index: true },
    report_date: { type: String, required: true },
    period_label: { type: String, required: true },
    lifecycle_status: { type: String, required: true },
    health_status: { type: String, required: true },
    health_reasons: { type: [String], default: [] },
    progress: {
      total_planned: { type: Number, default: 0 },
      published: { type: Number, default: 0 },
      scheduled_upcoming: { type: Number, default: 0 },
      awaiting_approval: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      skipped: { type: Number, default: 0 },
      percent_complete: { type: Number, default: 0 },
      days_elapsed: { type: Number, default: 0 },
      days_remaining: { type: Number, default: 0 },
    },
    highlights: { type: [String], default: [] },
    risks: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    narrative_summary: { type: String, default: "" },
    upcoming_7d: {
      type: [{ title: String, scheduled_at: String, status: String }],
      default: [],
    },
    pending_approvals: {
      type: [{ title: String, due_at: String, scheduled_post_id: String }],
      default: [],
    },
    generated_at: { type: Date, default: Date.now },
    emailed_at: { type: Date },
    email_recipient_ids: { type: [String], default: [] },
  },
  { timestamps: false }
);

campaignProgressReportSchema.index({ campaign_id: 1, report_date: 1 }, { unique: true });

export default model<CampaignProgressReport>("CampaignProgressReport", campaignProgressReportSchema);

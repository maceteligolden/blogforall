import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface BehavioralRule {
  rule_id: string;
  category: string;
  rule_text: string;
  polarity: "prefer" | "avoid";
  confidence: number;
  source: string;
}

export interface WorkspaceMemoryResponse {
  strategic: {
    business_type?: string;
    target_audience: string[];
    brand_voice?: string;
    business_goals: string[];
    seo_priorities: string[];
    publishing_channels: string[];
    competitive_notes?: string;
  };
  preferences: {
    tone?: string;
    formatting?: string;
    communication_style?: string;
    default_word_count?: number;
  };
  operational: Record<string, unknown>;
  memory_summary: string;
  content_summary: string;
  behavioral_rules: BehavioralRule[];
  strategy_state: {
    active_themes: { name: string; pillar: string; priority: number }[];
    content_clusters: { cluster_id: string; topics: string[]; cadence_hint?: string }[];
    calendar_horizon_weeks: number;
    last_strategy_review_at?: string;
  };
  version: number;
}

export interface StrategyGenerateResult {
  ideas: Array<{
    title: string;
    angle: string;
    funnel_stage: string;
    effort: string;
    confidence: number;
    rationale: string;
  }>;
  themes: Array<{ name: string; pillar: string; priority: number }>;
  clusters: Array<{ cluster_id: string; topics: string[]; cadence_hint?: string }>;
  calendar: Array<{
    scheduled_at: string;
    idea_title: string;
    objective: string;
    narrative_phase: string;
    auto_generate_prompt: string;
  }>;
  horizon_weeks: number;
}

export class MemoryService {
  static async getMemory(siteId: string) {
    const res = await apiClient.get(API_ENDPOINTS.MEMORY.GET(siteId));
    return res.data.data as WorkspaceMemoryResponse;
  }

  static async updateMemory(siteId: string, patch: Partial<WorkspaceMemoryResponse>) {
    const res = await apiClient.patch(API_ENDPOINTS.MEMORY.GET(siteId), patch);
    return res.data.data;
  }

  static async getStrategy(siteId: string) {
    const res = await apiClient.get(API_ENDPOINTS.MEMORY.STRATEGY(siteId));
    return res.data.data;
  }

  static async generateStrategy(siteId: string, horizonWeeks?: number) {
    const res = await apiClient.post(API_ENDPOINTS.MEMORY.GENERATE_STRATEGY(siteId), {
      horizon_weeks: horizonWeeks,
    });
    return res.data.data as StrategyGenerateResult;
  }
}

import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface WorkspaceStrategy {
  _id?: string;
  site_id: string;
  purpose: string;
  long_term_outcomes: string[];
  principles: string[];
  audience_summary?: string;
  perception_goals: string[];
  constraints: string[];
  version: number;
  status: "active" | "archived";
  generated_from?: string;
  confidence_summary?: number;
  created_at?: string;
  updated_at?: string;
}

export interface KnowledgeGap {
  key: string;
  importance: number;
  confidence: number;
  strategic_value: number;
  question: string;
  status: "missing" | "low_confidence";
}

export interface StrategicDecision {
  kind: string;
  title: string;
  rationale: string;
  score: number;
  campaign_id?: string;
  knowledge_key?: string;
  question?: string;
  proposal_id?: string;
}

export interface StrategicDecisionResult {
  decisions: StrategicDecision[];
  strategy_id?: string;
  default_campaign_id?: string;
  top: StrategicDecision | null;
}

export interface DecisionProposalResult {
  proposal_id: string;
  status: "pending_approval" | "applied" | "rejected";
  decision: StrategicDecision;
  draft_items?: Array<{
    title: string;
    objective: string;
    narrative_phase?: string;
    auto_generate_prompt?: string;
  }>;
  message: string;
}

export class StrategicService {
  static async getStrategy(siteId: string) {
    const res = await apiClient.get(API_ENDPOINTS.STRATEGIC.STRATEGY(siteId));
    return res.data.data as WorkspaceStrategy;
  }

  static async updateStrategy(
    siteId: string,
    patch: Partial<
      Pick<
        WorkspaceStrategy,
        | "purpose"
        | "long_term_outcomes"
        | "principles"
        | "audience_summary"
        | "perception_goals"
        | "constraints"
      >
    >
  ) {
    const res = await apiClient.patch(API_ENDPOINTS.STRATEGIC.STRATEGY(siteId), patch);
    return res.data.data as WorkspaceStrategy;
  }

  static async listStrategyVersions(siteId: string) {
    const res = await apiClient.get(API_ENDPOINTS.STRATEGIC.STRATEGY_VERSIONS(siteId));
    return res.data.data as WorkspaceStrategy[];
  }

  static async regenerateStrategy(siteId: string) {
    const res = await apiClient.post(API_ENDPOINTS.STRATEGIC.STRATEGY_REGENERATE(siteId));
    return res.data.data as WorkspaceStrategy;
  }

  static async listGaps(siteId: string) {
    const res = await apiClient.get(API_ENDPOINTS.STRATEGIC.KNOWLEDGE_GAPS(siteId));
    return res.data.data as KnowledgeGap[];
  }

  static async getNextDecisions(siteId: string, campaignId?: string) {
    const res = await apiClient.get(API_ENDPOINTS.STRATEGIC.DECISIONS_NEXT(siteId), {
      params: campaignId ? { campaign_id: campaignId } : undefined,
    });
    return res.data.data as StrategicDecisionResult;
  }

  static async proposeDecisionAction(
    siteId: string,
    body: { kind: string; campaign_id?: string; accept?: boolean }
  ) {
    const res = await apiClient.post(API_ENDPOINTS.STRATEGIC.DECISIONS_PROPOSE(siteId), body);
    return res.data.data as DecisionProposalResult;
  }

  static async updateKnowledge(
    siteId: string,
    key: string,
    body: { value?: unknown; confidence?: number; source?: string; status?: string }
  ) {
    const res = await apiClient.patch(API_ENDPOINTS.STRATEGIC.KNOWLEDGE_KEY(siteId, key), body);
    return res.data.data;
  }
}

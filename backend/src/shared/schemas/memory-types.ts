/** Shared memory type definitions used across workspace memory and services. */

export type BehavioralRuleCategory = "style" | "structure" | "topic" | "constraint" | "workflow";
export type BehavioralRulePolarity = "prefer" | "avoid";
export type BehavioralRuleSource = "user_explicit" | "inferred" | "feedback";

export interface BehavioralRule {
  rule_id: string;
  category: BehavioralRuleCategory;
  rule_text: string;
  polarity: BehavioralRulePolarity;
  confidence: number;
  source: BehavioralRuleSource;
  evidence_refs: string[];
  created_at: Date;
  superseded_by?: string;
}

export interface StrategyTheme {
  name: string;
  pillar: string;
  priority: number;
}

export interface ContentCluster {
  cluster_id: string;
  topics: string[];
  cadence_hint?: string;
}

export interface StrategyState {
  active_themes: StrategyTheme[];
  content_clusters: ContentCluster[];
  calendar_horizon_weeks: number;
  last_strategy_review_at?: Date;
}

export interface EngagementSignal {
  metric: string;
  content_id: string;
  value: number;
  captured_at: Date;
}

export type MemoryChunkSourceType =
  | "conversation"
  | "blog"
  | "knowledge_doc"
  | "user_note"
  | "rant"
  | "behavioral_rule";

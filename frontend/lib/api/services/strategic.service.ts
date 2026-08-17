import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export type ContentStrategyGenerationStatus = "generating" | "ready" | "failed";

export interface ContentStrategyAudienceProfile {
  who: string;
  situation: string;
  jtbd: string;
  beliefs_to_change: string[];
}

export interface ContentStrategyDocument {
  north_star: {
    what_we_are: string;
    what_we_sell: string;
    commercial_goal: string;
    growth_priority: string;
  };
  audience: {
    primary: ContentStrategyAudienceProfile;
    secondary?: ContentStrategyAudienceProfile;
    awareness_stage: string;
  };
  positioning: {
    category: string;
    differentiation: string;
    value_proposition: string;
    competitors: Array<{ name: string; notes?: string }>;
    statement: string;
  };
  narrative: {
    core_message: string;
    supporting_messages: string[];
    proof_points: string[];
    claims_we_can_make: string[];
    claims_we_must_not_make: string[];
    editorial_pov: string;
  };
  content_franchise: {
    pillars: Array<{
      name: string;
      in_scope: string[];
      out_of_scope: string[];
      authority_thesis: string;
    }>;
    offer_mapping: Array<{ pillar: string; product_or_cta: string }>;
  };
  voice: {
    personality: string;
    voice: string;
    tone_range: string;
    writing_principles: string[];
    words_to_use: string[];
    words_to_avoid: string[];
  };
  jobs_of_content: {
    awareness: number;
    authority: number;
    demand: number;
    conversion: number;
    retention: number;
  };
  conversion: {
    desired_action: string;
    primary_cta: string;
    secondary_cta: string;
    how_content_supports_offer: string;
  };
  guardrails: {
    always: string[];
    never: string[];
    accuracy_bar: string;
    audience_restrictions: string[];
  };
  measurement: {
    content_kpis: string[];
    business_outcomes: string[];
  };
  discovery?: {
    topic_clusters: string[];
    search_intent_posture: string;
    aeo_notes: string;
  };
  distribution?: {
    blog_role: string;
    email_role: string;
    social_role: string;
  };
}

export function emptyContentStrategyDocument(): ContentStrategyDocument {
  return {
    north_star: { what_we_are: "", what_we_sell: "", commercial_goal: "", growth_priority: "" },
    audience: {
      primary: { who: "", situation: "", jtbd: "", beliefs_to_change: [] },
      awareness_stage: "",
    },
    positioning: {
      category: "",
      differentiation: "",
      value_proposition: "",
      competitors: [],
      statement: "",
    },
    narrative: {
      core_message: "",
      supporting_messages: [],
      proof_points: [],
      claims_we_can_make: [],
      claims_we_must_not_make: [],
      editorial_pov: "",
    },
    content_franchise: { pillars: [], offer_mapping: [] },
    voice: {
      personality: "",
      voice: "",
      tone_range: "",
      writing_principles: [],
      words_to_use: [],
      words_to_avoid: [],
    },
    jobs_of_content: { awareness: 0.2, authority: 0.2, demand: 0.2, conversion: 0.2, retention: 0.2 },
    conversion: { desired_action: "", primary_cta: "", secondary_cta: "", how_content_supports_offer: "" },
    guardrails: { always: [], never: [], accuracy_bar: "", audience_restrictions: [] },
    measurement: { content_kpis: [], business_outcomes: [] },
  };
}

export function isContentStrategyReady(strategy?: WorkspaceStrategy | null): boolean {
  if (!strategy || strategy.generation_status === "generating") return false;
  if (strategy.generation_status === "failed") return false;
  const d = strategy.document;
  return Boolean(
    d?.north_star?.what_we_are?.trim() ||
      d?.positioning?.statement?.trim() ||
      d?.audience?.primary?.who?.trim() ||
      strategy.purpose?.trim()
  );
}

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
  generation_status?: ContentStrategyGenerationStatus;
  website_url?: string;
  document: ContentStrategyDocument;
  section_confidence?: Record<string, { confidence: number; source?: string }>;
  generation_error?: string;
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
    const raw = res.data.data as WorkspaceStrategy;
    return {
      ...raw,
      document: raw.document ?? emptyContentStrategyDocument(),
    } as WorkspaceStrategy;
  }

  static async updateStrategy(
    siteId: string,
    patch: Partial<WorkspaceStrategy> & { document?: ContentStrategyDocument; website_url?: string }
  ) {
    const res = await apiClient.patch(API_ENDPOINTS.STRATEGIC.STRATEGY(siteId), patch);
    const raw = res.data.data as WorkspaceStrategy;
    return {
      ...raw,
      document: raw.document ?? emptyContentStrategyDocument(),
    } as WorkspaceStrategy;
  }

  static async listStrategyVersions(siteId: string) {
    const res = await apiClient.get(API_ENDPOINTS.STRATEGIC.STRATEGY_VERSIONS(siteId));
    return res.data.data as WorkspaceStrategy[];
  }

  static async regenerateStrategy(siteId: string, websiteUrl?: string) {
    const res = await apiClient.post(API_ENDPOINTS.STRATEGIC.STRATEGY_REGENERATE(siteId), websiteUrl ? { website_url: websiteUrl } : {});
    const raw = res.data.data as WorkspaceStrategy;
    return {
      ...raw,
      document: raw.document ?? emptyContentStrategyDocument(),
    } as WorkspaceStrategy;
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

  static async proposeDecisionAction(siteId: string, body: { kind: string; campaign_id?: string; accept?: boolean }) {
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

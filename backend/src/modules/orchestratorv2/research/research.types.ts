export type ResearchDepth = "lite" | "full";

export type SourceTier = 1 | 2 | 3 | 4;

export type ClaimKind = "fact" | "interpretation" | "opinion" | "statistic" | "definition" | "limitation";

export type ResearchPurpose =
  | "general"
  | "post"
  | "campaign"
  | "strategy"
  | "discussion";

export interface ResearchSubquestion {
  id: string;
  question: string;
  category: string;
  covered: boolean;
}

export interface ResearchBriefState {
  research_question: string;
  objectives: string[];
  constraints: string[];
  decision_criteria: string[];
  source_strategy: string;
}

export interface ResearchSearchRecord {
  query: string;
  phase: "discover" | "search" | "verify" | "contrarian";
  result_count: number;
}

export interface ResearchDocument {
  id: string;
  url: string;
  title: string;
  snippet: string;
  extracted_text?: string;
  source: string;
  tier: SourceTier;
  publication_date?: string;
  relevance_score: number;
  credibility_score: number;
  quality_score: number;
}

export interface ResearchClaim {
  id: string;
  claim: string;
  kind: ClaimKind;
  source_ids: string[];
  supporting_evidence: string[];
  contradicting_evidence: string[];
  confidence: number;
  subquestion_ids: string[];
  verified: boolean;
}

export interface ResearchFinding {
  id: string;
  title: string;
  finding: string;
  evidence: string;
  confidence: "high" | "medium" | "low";
  implication: string;
  limitation: string;
  claim_ids: string[];
}

export interface ResearchCriticNotes {
  answered_original: boolean;
  important_claims_evidenced: boolean;
  looked_for_contradictions: boolean;
  unknowns: string[];
  confidence_statement: string;
  score: number;
  pass: boolean;
}

export interface ResearchGraphInput {
  workspace_id: string;
  question: string;
  depth?: ResearchDepth;
  purpose?: ResearchPurpose;
  audience?: string;
  persist?: boolean;
  created_by?: string;
  thread_id?: string;
  signal?: AbortSignal;
  onPhase?: (event: {
    phase: string;
    message: string;
    percent?: number;
    skill_id?: string;
  }) => void;
}

export interface ResearchGraphResult {
  package_id: string;
  report_markdown: string;
  spoken_summary: string;
  summary: {
    topic: string;
    depth: ResearchDepth;
    coverage_score: number;
    source_count: number;
    contradiction_count: number;
    degraded?: boolean;
  };
  findings: ResearchFinding[];
  degraded: boolean;
}

export type CampaignTopicSuggestion = {
  title: string;
  about: string;
  keywords: string[];
  post_type:
    | "article"
    | "tutorial"
    | "how_to"
    | "listicle"
    | "opinion"
    | "case_study"
    | "definitive_guide"
    | "software_roundup"
    | "comparison"
    | "thought_leadership";
  campaign_support: string;
};

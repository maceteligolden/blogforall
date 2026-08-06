/**
 * Canonical business-knowledge keys (doc 21).
 * Stored as MemoryRecord.canonical_key on workspace/knowledge layers.
 */
export const BUSINESS_KNOWLEDGE_KEYS = [
  "business.industries",
  "business.model",
  "business.description",
  "business.type", // legacy alias → projects to business_description
  "business.audience",
  "business.customers",
  "business.brand_voice",
  "business.brand_negatives",
  "business.goals",
  "business.publishing_channels",
  "business.seo_priorities",
  "business.competitors",
  "business.positioning",
  "business.usp",
  "business.pricing",
  "business.values",
  "business.objections",
  "business.case_studies",
  "business.differentiators",
  "business.faqs",
  "business.products",
  "business.services",
  "business.tone",
] as const;

export type BusinessKnowledgeKey = (typeof BUSINESS_KNOWLEDGE_KEYS)[number];

/** Importance weight for gap scoring (0–1). */
export const BUSINESS_KNOWLEDGE_IMPORTANCE: Record<BusinessKnowledgeKey, number> = {
  "business.industries": 0.75,
  "business.model": 0.8,
  "business.description": 0.95,
  "business.type": 0.5,
  "business.audience": 0.85,
  "business.customers": 1.0,
  "business.brand_voice": 0.85,
  "business.brand_negatives": 0.7,
  "business.goals": 0.95,
  "business.publishing_channels": 0.6,
  "business.seo_priorities": 0.7,
  "business.competitors": 0.75,
  "business.positioning": 0.9,
  "business.usp": 1.0,
  "business.pricing": 0.7,
  "business.values": 0.65,
  "business.objections": 0.9,
  "business.case_studies": 0.8,
  "business.differentiators": 0.9,
  "business.faqs": 0.55,
  "business.products": 0.85,
  "business.services": 0.85,
  "business.tone": 0.7,
};

/** High-value questions when a key is missing or low-confidence. */
export const BUSINESS_KNOWLEDGE_QUESTIONS: Record<BusinessKnowledgeKey, string> = {
  "business.industries": "Which industries does your business operate in?",
  "business.model": "Is your business B2B, B2C, C2C, or B2B2C?",
  "business.description": "Describe your business in a short paragraph — what you do and for whom.",
  "business.type": "What does your business do in one sentence?",
  "business.audience": "What short labels describe your ideal customers?",
  "business.customers":
    "Who are your customers — describe who they are, the pain you solve, and what success looks like?",
  "business.brand_voice": "Describe how your brand should sound in content (voice, personality, cadence).",
  "business.brand_negatives": "What words, tones, or claims should your brand never use?",
  "business.goals": "What long-term outcomes should content drive?",
  "business.publishing_channels": "Where do you primarily publish and promote content?",
  "business.seo_priorities": "Which topics or keywords matter most for SEO?",
  "business.competitors": "Who are your main competitors, and how do you differ?",
  "business.positioning": "How do you want to be perceived in the market?",
  "business.usp": "What is your unique selling proposition?",
  "business.pricing": "How do you think about pricing and value?",
  "business.values": "What values should never be compromised in content?",
  "business.objections": "What objections do customers raise most often?",
  "business.case_studies": "What is your strongest customer success story?",
  "business.differentiators": "What makes you meaningfully different from alternatives?",
  "business.faqs": "What questions do prospects ask before buying?",
  "business.products": "What products should content support?",
  "business.services": "What services should content support?",
  "business.tone": "Any tone preferences beyond brand voice?",
};

/** Map WorkspaceMemory.strategic fields → canonical keys for seeding. */
export const WORKSPACE_STRATEGIC_TO_KEY: Record<string, BusinessKnowledgeKey> = {
  industries: "business.industries",
  business_model: "business.model",
  business_description: "business.description",
  target_audience: "business.audience",
  customers: "business.customers",
  brand_voice: "business.brand_voice",
  brand_negatives: "business.brand_negatives",
  business_goals: "business.goals",
  publishing_channels: "business.publishing_channels",
  seo_priorities: "business.seo_priorities",
  competitors: "business.competitors",
};

/** Preferences fields that map onto business beliefs. */
export const WORKSPACE_PREFERENCE_TO_KEY: Record<string, BusinessKnowledgeKey> = {
  tone: "business.tone",
};

/**
 * Dot-path field_paths from MemoryExtraction → canonical keys.
 * Includes strategic.* and preferences.* aliases.
 */
export const FIELD_PATH_TO_KEY: Record<string, BusinessKnowledgeKey> = {
  "strategic.industries": "business.industries",
  "strategic.business_model": "business.model",
  "strategic.business_description": "business.description",
  "strategic.business_type": "business.description",
  "strategic.target_audience": "business.audience",
  "strategic.customers": "business.customers",
  "strategic.brand_voice": "business.brand_voice",
  "strategic.brand_negatives": "business.brand_negatives",
  "strategic.business_goals": "business.goals",
  "strategic.publishing_channels": "business.publishing_channels",
  "strategic.seo_priorities": "business.seo_priorities",
  "strategic.competitors": "business.competitors",
  "strategic.competitive_notes": "business.competitors",
  "preferences.tone": "business.tone",
  industries: "business.industries",
  business_model: "business.model",
  business_description: "business.description",
  business_type: "business.description",
  target_audience: "business.audience",
  customers: "business.customers",
  brand_voice: "business.brand_voice",
  brand_negatives: "business.brand_negatives",
  business_goals: "business.goals",
  publishing_channels: "business.publishing_channels",
  seo_priorities: "business.seo_priorities",
  competitors: "business.competitors",
  competitive_notes: "business.competitors",
  tone: "business.tone",
};

/** Belief lifecycle status (doc 21). */
export type BeliefStatus = "new" | "confirmed" | "updated" | "invalidated";

/** Knowledge source identifiers (doc 21). */
export type BeliefSource =
  | "onboarding"
  | "website_inferred"
  | "conversation"
  | "edit"
  | "publish"
  | "analytics"
  | "user_explicit"
  | "doc_upload"
  | "onboarding_backfill";

/** Source-aware default confidence (doc 21 implementation status). */
export const SOURCE_CONFIDENCE: Record<BeliefSource, number> = {
  website_inferred: 0.5,
  onboarding: 0.7,
  onboarding_backfill: 0.55,
  conversation: 0.65,
  edit: 0.75,
  publish: 0.6,
  analytics: 0.55,
  user_explicit: 0.8,
  doc_upload: 0.6,
};

export function confidenceForSource(source?: string, override?: number): number {
  if (override != null) return Math.min(0.98, Math.max(0, override));
  if (source && source in SOURCE_CONFIDENCE) {
    return SOURCE_CONFIDENCE[source as BeliefSource];
  }
  return SOURCE_CONFIDENCE.onboarding_backfill;
}

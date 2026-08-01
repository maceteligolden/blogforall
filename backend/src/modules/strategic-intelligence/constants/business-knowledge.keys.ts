/**
 * Canonical business-knowledge keys (doc 21).
 * Stored as MemoryRecord.canonical_key on workspace/knowledge layers.
 */
export const BUSINESS_KNOWLEDGE_KEYS = [
  "business.type",
  "business.audience",
  "business.brand_voice",
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
  "business.type": 0.9,
  "business.audience": 1.0,
  "business.brand_voice": 0.85,
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
  "business.type": "What does your business do in one sentence?",
  "business.audience": "Who is your ideal customer (role, company stage, pain)?",
  "business.brand_voice": "How should your brand sound — tone and words to avoid?",
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
  business_type: "business.type",
  target_audience: "business.audience",
  brand_voice: "business.brand_voice",
  business_goals: "business.goals",
  publishing_channels: "business.publishing_channels",
  seo_priorities: "business.seo_priorities",
  competitive_notes: "business.competitors",
};

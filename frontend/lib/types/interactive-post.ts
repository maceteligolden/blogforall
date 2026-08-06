export type InteractivePostType =
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

export type TopicSuggestion = {
  id: string;
  title: string;
  about: string;
  campaign_id?: string;
  campaign_name?: string;
  campaign_support: string;
  keywords: string[];
  post_type: InteractivePostType;
};

export type PostEnrichment = {
  links?: string[];
  example_urls?: string[];
  personal_notes?: string;
  must_include?: string;
  must_avoid?: string;
  target_audience?: string;
  cta?: string;
  tone?: string;
  length_preset?: "short" | "medium" | "long" | "pillar";
  word_count?: number;
  style_variant?: string;
};

export type OutlineSection = {
  id: string;
  heading: string;
  intent: string;
};

export type PostOutline = {
  working_title: string;
  thesis: string;
  sections: OutlineSection[];
  keyword_notes: string;
  campaign_tie_in: string;
  post_type: InteractivePostType;
  keywords: string[];
  campaign_id?: string;
  style_variant?: string;
  content_archetype?: string;
};

export type AiWizardStep = "seed" | "topics" | "enrich" | "outline" | "generate" | "done";

export const AI_WIZARD_STEPS: Array<{ id: AiWizardStep; label: string }> = [
  { id: "seed", label: "Intent" },
  { id: "topics", label: "Topics" },
  { id: "enrich", label: "Improve" },
  { id: "outline", label: "Plan" },
  { id: "generate", label: "Generate" },
];

export const STYLE_VARIANT_OPTIONS = [
  { value: "", label: "Auto (recommended)" },
  { value: "operator_checklist", label: "How-to: operator checklist" },
  { value: "coach_walkthrough", label: "How-to: coach walkthrough" },
  { value: "war_story_howto", label: "How-to: war story" },
  { value: "curated_survey", label: "Listicle: curated survey" },
  { value: "ranked_picks", label: "Listicle: ranked picks" },
  { value: "buyer_brief", label: "Roundup: buyer brief" },
  { value: "criteria_debate", label: "Comparison: criteria debate" },
  { value: "customer_hero", label: "Case study: customer hero" },
  { value: "polemic", label: "Thought leadership: polemic" },
  { value: "framework_essay", label: "Framework essay" },
  { value: "field_manual", label: "Definitive: field manual" },
] as const;

export function postTypeLabel(type: InteractivePostType): string {
  switch (type) {
    case "how_to":
      return "How-to";
    case "case_study":
      return "Case study";
    case "listicle":
      return "Listicle";
    case "definitive_guide":
      return "Definitive guide";
    case "software_roundup":
      return "Software roundup";
    case "comparison":
      return "Comparison";
    case "thought_leadership":
      return "Thought leadership";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

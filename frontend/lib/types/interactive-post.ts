export type InteractivePostType =
  | "article"
  | "tutorial"
  | "how_to"
  | "listicle"
  | "opinion"
  | "case_study";

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
  length_preset?: "short" | "medium" | "long";
  word_count?: number;
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
};

export type AiWizardStep = "seed" | "topics" | "enrich" | "outline" | "generate" | "done";

export const AI_WIZARD_STEPS: Array<{ id: AiWizardStep; label: string }> = [
  { id: "seed", label: "Intent" },
  { id: "topics", label: "Topics" },
  { id: "enrich", label: "Improve" },
  { id: "outline", label: "Plan" },
  { id: "generate", label: "Generate" },
];

export function postTypeLabel(type: InteractivePostType): string {
  switch (type) {
    case "how_to":
      return "How-to";
    case "case_study":
      return "Case study";
    case "listicle":
      return "Listicle";
    default:
      return type.charAt(0).toUpperCase() + type.slice(1);
  }
}

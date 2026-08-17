/** Brand-memory checklist items deferred after workspace creation (matches backend SETUP_ITEMS). */
export const BRAND_SETUP_ITEMS = [
  { id: "business_description", label: "What your business does" },
  { id: "customers", label: "Who you write for" },
  { id: "brand_voice", label: "Brand voice" },
  { id: "business_goals", label: "Business goals" },
  { id: "publishing_channels", label: "Where you publish" },
] as const;

export const SETUP_INTERVIEW_PENDING_KEY = "bloggr_setup_interview_pending";
export const SETUP_BANNER_DISMISSED_KEY = "bloggr_setup_banner_dismissed";
/** Prefills dashboard chat composer when refining Content Strategy. */
export const BUSINESS_REFINE_PROMPT_KEY = "bloggr_business_refine_prompt";

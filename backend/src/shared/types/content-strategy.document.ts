import { z } from "zod";
import type { WorkspaceMemoryStrategic } from "../schemas/workspace-memory.schema";
import { migrateStrategicMemory } from "../utils/migrate-strategic-memory";

export type ContentStrategyEvidenceSource = "website" | "user" | "inferred";
export type ContentStrategyGenerationStatus = "generating" | "ready" | "failed";

export const CONTENT_STRATEGY_SECTIONS = [
  "north_star",
  "audience",
  "positioning",
  "narrative",
  "content_franchise",
  "voice",
  "jobs_of_content",
  "conversion",
  "guardrails",
  "measurement",
  "discovery",
  "distribution",
] as const;

export type ContentStrategySection = (typeof CONTENT_STRATEGY_SECTIONS)[number];

export interface ContentStrategySectionConfidence {
  confidence: number;
  source: ContentStrategyEvidenceSource;
}

export interface ContentStrategyAudienceProfile {
  who: string;
  situation: string;
  jtbd: string;
  beliefs_to_change: string[];
}

export interface ContentStrategyCompetitor {
  name: string;
  notes?: string;
}

export interface ContentStrategyPillar {
  name: string;
  in_scope: string[];
  out_of_scope: string[];
  authority_thesis: string;
}

export interface ContentStrategyOfferMap {
  pillar: string;
  product_or_cta: string;
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
    competitors: ContentStrategyCompetitor[];
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
    pillars: ContentStrategyPillar[];
    offer_mapping: ContentStrategyOfferMap[];
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

export type ContentStrategySectionConfidenceMap = Partial<
  Record<ContentStrategySection, ContentStrategySectionConfidence>
>;

const str = (max = 2000) => z.string().max(max);
const strList = (maxItem = 500, maxItems = 12) => z.array(z.string().max(maxItem)).max(maxItems);
const weight = z.number().min(0).max(1);

const audienceProfileSchema = z.object({
  who: str(800).optional().default(""),
  situation: str(800).optional().default(""),
  jtbd: str(800).optional().default(""),
  beliefs_to_change: strList().optional().default([]),
});

const competitorSchema = z.object({
  name: str(200),
  notes: str(1000).optional(),
});

const pillarSchema = z.object({
  name: str(200),
  in_scope: strList().optional().default([]),
  out_of_scope: strList().optional().default([]),
  authority_thesis: str(800).optional().default(""),
});

export const contentStrategyDocumentSchema = z.object({
  north_star: z
    .object({
      what_we_are: str(800).optional().default(""),
      what_we_sell: str(800).optional().default(""),
      commercial_goal: str(800).optional().default(""),
      growth_priority: str(800).optional().default(""),
    })
    .optional()
    .default({}),
  audience: z
    .object({
      primary: audienceProfileSchema.optional().default({}),
      secondary: audienceProfileSchema.optional(),
      awareness_stage: str(200).optional().default(""),
    })
    .optional()
    .default({}),
  positioning: z
    .object({
      category: str(400).optional().default(""),
      differentiation: str(800).optional().default(""),
      value_proposition: str(800).optional().default(""),
      competitors: z.array(competitorSchema).max(15).optional().default([]),
      statement: str(800).optional().default(""),
    })
    .optional()
    .default({}),
  narrative: z
    .object({
      core_message: str(800).optional().default(""),
      supporting_messages: strList().optional().default([]),
      proof_points: strList().optional().default([]),
      claims_we_can_make: strList().optional().default([]),
      claims_we_must_not_make: strList().optional().default([]),
      editorial_pov: str(800).optional().default(""),
    })
    .optional()
    .default({}),
  content_franchise: z
    .object({
      pillars: z.array(pillarSchema).max(8).optional().default([]),
      offer_mapping: z
        .array(
          z.object({
            pillar: str(200),
            product_or_cta: str(400),
          })
        )
        .max(12)
        .optional()
        .default([]),
    })
    .optional()
    .default({}),
  voice: z
    .object({
      personality: str(400).optional().default(""),
      voice: str(400).optional().default(""),
      tone_range: str(400).optional().default(""),
      writing_principles: strList().optional().default([]),
      words_to_use: strList(80, 20).optional().default([]),
      words_to_avoid: strList(80, 20).optional().default([]),
    })
    .optional()
    .default({}),
  jobs_of_content: z
    .object({
      awareness: weight.optional().default(0.2),
      authority: weight.optional().default(0.2),
      demand: weight.optional().default(0.2),
      conversion: weight.optional().default(0.2),
      retention: weight.optional().default(0.2),
    })
    .optional()
    .default({}),
  conversion: z
    .object({
      desired_action: str(400).optional().default(""),
      primary_cta: str(400).optional().default(""),
      secondary_cta: str(400).optional().default(""),
      how_content_supports_offer: str(800).optional().default(""),
    })
    .optional()
    .default({}),
  guardrails: z
    .object({
      always: strList().optional().default([]),
      never: strList().optional().default([]),
      accuracy_bar: str(400).optional().default(""),
      audience_restrictions: strList().optional().default([]),
    })
    .optional()
    .default({}),
  measurement: z
    .object({
      content_kpis: strList().optional().default([]),
      business_outcomes: strList().optional().default([]),
    })
    .optional()
    .default({}),
  discovery: z
    .object({
      topic_clusters: strList(200, 20).optional().default([]),
      search_intent_posture: str(800).optional().default(""),
      aeo_notes: str(800).optional().default(""),
    })
    .optional(),
  distribution: z
    .object({
      blog_role: str(400).optional().default(""),
      email_role: str(400).optional().default(""),
      social_role: str(400).optional().default(""),
    })
    .optional(),
});

export type ContentStrategyDocumentInput = z.input<typeof contentStrategyDocumentSchema>;

export function emptyContentStrategyDocument(): ContentStrategyDocument {
  return contentStrategyDocumentSchema.parse({});
}

export function parseContentStrategyDocument(raw: unknown): ContentStrategyDocument {
  const parsed = contentStrategyDocumentSchema.safeParse(raw ?? {});
  return parsed.success ? parsed.data : emptyContentStrategyDocument();
}

function deepMerge<T extends Record<string, unknown>>(base: T, patch: Partial<T> | undefined): T {
  if (!patch) return base;
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value == null) continue;
    const current = out[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      current &&
      typeof current === "object" &&
      !Array.isArray(current)
    ) {
      out[key] = deepMerge(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      out[key] = value;
    }
  }
  return out as T;
}

export function coalesceContentStrategyDocument(
  primary: ContentStrategyDocument,
  fallback: ContentStrategyDocument
): ContentStrategyDocument {
  const str = (a: string, b: string) => (a.trim() ? a : b);
  const list = (a: string[], b: string[]) => (a.length ? a : b);
  const merged = emptyContentStrategyDocument();
  merged.north_star = {
    what_we_are: str(primary.north_star.what_we_are, fallback.north_star.what_we_are),
    what_we_sell: str(primary.north_star.what_we_sell, fallback.north_star.what_we_sell),
    commercial_goal: str(primary.north_star.commercial_goal, fallback.north_star.commercial_goal),
    growth_priority: str(primary.north_star.growth_priority, fallback.north_star.growth_priority),
  };
  merged.audience = {
    primary: {
      who: str(primary.audience.primary.who, fallback.audience.primary.who),
      situation: str(primary.audience.primary.situation, fallback.audience.primary.situation),
      jtbd: str(primary.audience.primary.jtbd, fallback.audience.primary.jtbd),
      beliefs_to_change: list(primary.audience.primary.beliefs_to_change, fallback.audience.primary.beliefs_to_change),
    },
    secondary: primary.audience.secondary ?? fallback.audience.secondary,
    awareness_stage: str(primary.audience.awareness_stage, fallback.audience.awareness_stage),
  };
  merged.positioning = {
    category: str(primary.positioning.category, fallback.positioning.category),
    differentiation: str(primary.positioning.differentiation, fallback.positioning.differentiation),
    value_proposition: str(primary.positioning.value_proposition, fallback.positioning.value_proposition),
    statement: str(primary.positioning.statement, fallback.positioning.statement),
    competitors: primary.positioning.competitors.length
      ? primary.positioning.competitors
      : fallback.positioning.competitors,
  };
  merged.narrative = {
    core_message: str(primary.narrative.core_message, fallback.narrative.core_message),
    supporting_messages: list(primary.narrative.supporting_messages, fallback.narrative.supporting_messages),
    proof_points: list(primary.narrative.proof_points, fallback.narrative.proof_points),
    claims_we_can_make: list(primary.narrative.claims_we_can_make, fallback.narrative.claims_we_can_make),
    claims_we_must_not_make: list(
      primary.narrative.claims_we_must_not_make,
      fallback.narrative.claims_we_must_not_make
    ),
    editorial_pov: str(primary.narrative.editorial_pov, fallback.narrative.editorial_pov),
  };
  merged.content_franchise = {
    pillars: primary.content_franchise.pillars.length
      ? primary.content_franchise.pillars
      : fallback.content_franchise.pillars,
    offer_mapping: primary.content_franchise.offer_mapping.length
      ? primary.content_franchise.offer_mapping
      : fallback.content_franchise.offer_mapping,
  };
  merged.voice = {
    personality: str(primary.voice.personality, fallback.voice.personality),
    voice: str(primary.voice.voice, fallback.voice.voice),
    tone_range: str(primary.voice.tone_range, fallback.voice.tone_range),
    writing_principles: list(primary.voice.writing_principles, fallback.voice.writing_principles),
    words_to_use: list(primary.voice.words_to_use, fallback.voice.words_to_use),
    words_to_avoid: list(primary.voice.words_to_avoid, fallback.voice.words_to_avoid),
  };
  merged.jobs_of_content = primary.jobs_of_content ?? fallback.jobs_of_content;
  merged.conversion = {
    desired_action: str(primary.conversion.desired_action, fallback.conversion.desired_action),
    primary_cta: str(primary.conversion.primary_cta, fallback.conversion.primary_cta),
    secondary_cta: str(primary.conversion.secondary_cta, fallback.conversion.secondary_cta),
    how_content_supports_offer: str(
      primary.conversion.how_content_supports_offer,
      fallback.conversion.how_content_supports_offer
    ),
  };
  merged.guardrails = {
    always: list(primary.guardrails.always, fallback.guardrails.always),
    never: list(primary.guardrails.never, fallback.guardrails.never),
    accuracy_bar: str(primary.guardrails.accuracy_bar, fallback.guardrails.accuracy_bar),
    audience_restrictions: list(primary.guardrails.audience_restrictions, fallback.guardrails.audience_restrictions),
  };
  merged.measurement = {
    content_kpis: list(primary.measurement.content_kpis, fallback.measurement.content_kpis),
    business_outcomes: list(primary.measurement.business_outcomes, fallback.measurement.business_outcomes),
  };
  merged.discovery = primary.discovery ?? fallback.discovery;
  merged.distribution = primary.distribution ?? fallback.distribution;
  return parseContentStrategyDocument(merged);
}

export function mergeContentStrategyDocument(
  current: ContentStrategyDocument | undefined,
  patch: Partial<ContentStrategyDocument> | undefined
): ContentStrategyDocument {
  return parseContentStrategyDocument(
    deepMerge(
      parseContentStrategyDocument(current) as unknown as Record<string, unknown>,
      (patch ?? {}) as Record<string, unknown>
    )
  );
}

/** Fill remaining empty fields with inferred defaults so website generation is usable. */
export function ensureContentStrategyCompleteness(doc: ContentStrategyDocument): ContentStrategyDocument {
  const d = parseContentStrategyDocument(doc);
  const who = d.audience.primary.who.trim() || "the primary audience";
  const what = d.north_star.what_we_are.trim() || "this business";
  const sell = d.north_star.what_we_sell.trim() || "the core offer";

  if (!d.north_star.what_we_are.trim()) d.north_star.what_we_are = what;
  if (!d.north_star.what_we_sell.trim()) d.north_star.what_we_sell = sell;
  if (!d.north_star.commercial_goal.trim()) {
    d.north_star.commercial_goal = `Grow qualified demand for ${sell}`;
  }
  if (!d.north_star.growth_priority.trim()) {
    d.north_star.growth_priority = "Attract and convert the right buyers through content";
  }
  if (!d.audience.primary.who.trim()) {
    d.audience.primary.who = "Prospective customers visiting the website";
  }
  if (!d.audience.primary.situation.trim()) {
    d.audience.primary.situation = `Looking for a better way to get ${sell}`;
  }
  if (!d.audience.primary.jtbd.trim()) {
    d.audience.primary.jtbd = `Evaluate and choose ${what}`;
  }
  if (!d.audience.primary.beliefs_to_change.length) {
    d.audience.primary.beliefs_to_change = [`That ${what} is interchangeable with generic alternatives`];
  }
  if (!d.audience.awareness_stage.trim()) {
    d.audience.awareness_stage = "Problem-aware to solution-aware";
  }
  if (!d.positioning.category.trim()) d.positioning.category = sell;
  if (!d.positioning.value_proposition.trim()) {
    d.positioning.value_proposition = `${what} helps ${who} get a clearer path to ${sell}`;
  }
  if (!d.positioning.differentiation.trim()) {
    d.positioning.differentiation =
      d.positioning.value_proposition || `A focused alternative in ${d.positioning.category}`;
  }
  if (!d.positioning.statement.trim()) {
    d.positioning.statement = `For ${who}, ${what} is the ${d.positioning.category} that ${d.positioning.differentiation}`;
  }
  if (!d.narrative.core_message.trim()) d.narrative.core_message = d.positioning.value_proposition;
  if (!d.narrative.editorial_pov.trim()) {
    d.narrative.editorial_pov = `Practical, specific guidance for ${who}`;
  }
  if (!d.narrative.supporting_messages.length) {
    d.narrative.supporting_messages = [d.north_star.growth_priority, d.positioning.differentiation].filter(Boolean);
  }
  if (!d.narrative.proof_points.length) {
    d.narrative.proof_points = ["Use only proof visible on the website or confirmed by the owner"];
  }
  if (!d.narrative.claims_we_can_make.length) {
    d.narrative.claims_we_can_make = [d.positioning.value_proposition].filter(Boolean);
  }
  if (!d.narrative.claims_we_must_not_make.length) {
    d.narrative.claims_we_must_not_make = ["Do not invent pricing, guarantees, client names, or unstated credentials"];
  }
  if (!d.content_franchise.pillars.length) {
    d.content_franchise.pillars = [
      {
        name: "Audience problems",
        authority_thesis: `Help ${who} name and navigate their situation`,
        in_scope: ["pains", "jobs to be done"],
        out_of_scope: ["unrelated news"],
      },
      {
        name: "Point of view",
        authority_thesis: d.narrative.editorial_pov,
        in_scope: ["frameworks", "how we think"],
        out_of_scope: ["generic listicles"],
      },
      {
        name: "The offer",
        authority_thesis: `Connect ${sell} to outcomes without hard-selling`,
        in_scope: ["product education", "use cases"],
        out_of_scope: ["uncontextualized pitches"],
      },
    ];
  }
  if (!d.voice.personality.trim()) d.voice.personality = "Clear, confident, helpful";
  if (!d.voice.voice.trim()) d.voice.voice = d.voice.personality;
  if (!d.voice.tone_range.trim()) d.voice.tone_range = "Professional but human; never stiff or hypey";
  if (!d.voice.writing_principles.length) {
    d.voice.writing_principles = ["Lead with the reader", "Be specific", "Stay on-brief"];
  }
  if (!d.conversion.desired_action.trim()) {
    d.conversion.desired_action = d.north_star.commercial_goal;
  }
  if (!d.conversion.primary_cta.trim()) d.conversion.primary_cta = "Contact us";
  if (!d.conversion.secondary_cta.trim()) d.conversion.secondary_cta = "Learn more";
  if (!d.conversion.how_content_supports_offer.trim()) {
    d.conversion.how_content_supports_offer = `Content builds trust with ${who} so “${d.conversion.primary_cta}” is a natural next step.`;
  }
  if (!d.guardrails.always.length) {
    d.guardrails.always = ["Stay inside the content pillars", "Match voice and positioning"];
  }
  if (!d.guardrails.never.length) {
    d.guardrails.never = ["Invent facts", "Drift off-brief", "Use hype or unverified claims"];
  }
  if (!d.guardrails.accuracy_bar.trim()) {
    d.guardrails.accuracy_bar = "Only state facts supported by the website or confirmed knowledge";
  }
  if (!d.measurement.content_kpis.length) {
    d.measurement.content_kpis = [
      "Organic traffic to pillar pages",
      "Engagement (time on page, shares)",
      "CTA click-through",
    ];
  }
  if (!d.measurement.business_outcomes.length) {
    d.measurement.business_outcomes = [d.north_star.commercial_goal].filter(Boolean);
  }
  return parseContentStrategyDocument(d);
}

export function flattenContentStrategy(doc: ContentStrategyDocument): {
  purpose: string;
  audience_summary: string;
  long_term_outcomes: string[];
  principles: string[];
  perception_goals: string[];
  constraints: string[];
} {
  const purpose =
    doc.positioning.statement.trim() ||
    [doc.north_star.what_we_are, doc.north_star.commercial_goal].filter(Boolean).join(" — ") ||
    doc.narrative.core_message ||
    "Content Strategy";
  const audience_summary =
    [
      doc.audience.primary.who,
      doc.audience.primary.situation,
      doc.audience.awareness_stage ? `Awareness: ${doc.audience.awareness_stage}` : "",
    ]
      .filter(Boolean)
      .join(". ") || "";
  const constraints = [
    ...doc.guardrails.always.map((g) => `Always: ${g}`),
    ...doc.guardrails.never.map((g) => `Never: ${g}`),
    doc.guardrails.accuracy_bar ? `Accuracy: ${doc.guardrails.accuracy_bar}` : "",
    ...doc.guardrails.audience_restrictions.map((g) => `Audience restriction: ${g}`),
    ...doc.narrative.claims_we_must_not_make.map((c) => `Must not claim: ${c}`),
  ].filter(Boolean);
  const principles = [
    doc.voice.voice ? `Voice: ${doc.voice.voice}` : "",
    doc.voice.personality ? `Personality: ${doc.voice.personality}` : "",
    ...doc.voice.writing_principles,
    doc.narrative.editorial_pov ? `POV: ${doc.narrative.editorial_pov}` : "",
  ].filter(Boolean);
  return {
    purpose: purpose.slice(0, 2000),
    audience_summary: audience_summary.slice(0, 2000),
    long_term_outcomes: [
      doc.north_star.commercial_goal,
      doc.north_star.growth_priority,
      ...doc.measurement.business_outcomes,
    ].filter(Boolean),
    principles,
    perception_goals: [doc.positioning.value_proposition, doc.narrative.core_message].filter(Boolean),
    constraints: constraints.length ? constraints : ["Do not invent unsupported claims"],
  };
}

export function documentFromStrategicMemory(
  strategicRaw: WorkspaceMemoryStrategic | Record<string, unknown> | null | undefined
): ContentStrategyDocument {
  const s = migrateStrategicMemory(strategicRaw);
  const primaryWho =
    s.customers
      .map((c) => c.label || c.who)
      .filter(Boolean)
      .join("; ") || s.target_audience.join(", ");
  const pains = s.customers
    .map((c) => c.pain_points)
    .filter(Boolean)
    .join("; ");
  const success = s.customers
    .map((c) => c.success)
    .filter(Boolean)
    .join("; ");
  const doc = emptyContentStrategyDocument();
  doc.north_star.what_we_are = (s.business_description || s.business_type || "").trim();
  doc.north_star.what_we_sell = s.business_model || "";
  doc.north_star.commercial_goal = s.business_goals[0] || "";
  doc.north_star.growth_priority = s.business_goals[1] || s.business_goals[0] || "";
  doc.audience.primary.who = primaryWho;
  doc.audience.primary.situation = pains;
  doc.audience.primary.jtbd = success;
  doc.audience.primary.beliefs_to_change = [];
  doc.audience.awareness_stage = primaryWho ? "Problem-aware to solution-aware" : "";
  doc.positioning.category = s.industries[0] || s.business_type || "";
  doc.positioning.competitors = s.competitors.map((c) => ({ name: c.name, notes: c.notes }));
  doc.positioning.differentiation = s.competitive_notes || "";
  doc.positioning.value_proposition = (s.business_description || "").slice(0, 400);
  doc.positioning.statement = [s.business_description, primaryWho ? `for ${primaryWho}` : ""]
    .filter(Boolean)
    .join(" ")
    .slice(0, 600);
  doc.narrative.core_message = (s.business_description || "").slice(0, 800);
  doc.narrative.editorial_pov = s.brand_voice || "";
  doc.narrative.supporting_messages = s.business_goals.slice(0, 4);
  doc.narrative.claims_we_must_not_make = s.brand_negatives ? [s.brand_negatives] : [];
  if (s.seo_priorities.length) {
    doc.content_franchise.pillars = s.seo_priorities.slice(0, 6).map((name) => ({
      name,
      authority_thesis: `Own ${name} for ${primaryWho || "the audience"}`,
      in_scope: [name],
      out_of_scope: [],
    }));
  } else if (s.industries.length) {
    doc.content_franchise.pillars = s.industries.slice(0, 4).map((name) => ({
      name,
      authority_thesis: `Help buyers navigate ${name}`,
      in_scope: [name],
      out_of_scope: [],
    }));
  }
  doc.voice.personality = s.brand_voice || "";
  doc.voice.voice = s.brand_voice || "";
  doc.voice.tone_range = s.brand_voice || "";
  doc.voice.words_to_avoid = s.brand_negatives
    ? s.brand_negatives
        .split(/[,;]/)
        .map((w) => w.trim())
        .filter(Boolean)
    : [];
  doc.conversion.desired_action = s.business_goals[0] || "";
  doc.guardrails.never = s.brand_negatives ? [s.brand_negatives] : [];
  doc.measurement.business_outcomes = s.business_goals.slice(0, 5);
  if (s.seo_priorities.length) {
    doc.discovery = {
      topic_clusters: s.seo_priorities,
      search_intent_posture: "",
      aeo_notes: "",
    };
  }
  if (s.publishing_channels.length) {
    doc.distribution = {
      blog_role: s.publishing_channels.includes("blog") ? "Primary long-form channel" : "",
      email_role: s.publishing_channels.includes("email") ? "Nurture and conversion" : "",
      social_role: s.publishing_channels.filter((c) => c !== "blog" && c !== "email").join(", "),
    };
  }
  return parseContentStrategyDocument(doc);
}

export function documentHasSubstance(doc: ContentStrategyDocument | undefined): boolean {
  if (!doc) return false;
  return Boolean(
    doc.north_star.what_we_are.trim() ||
    doc.positioning.statement.trim() ||
    doc.audience.primary.who.trim() ||
    doc.narrative.core_message.trim()
  );
}

export function isContentStrategyReady(
  generationStatus: ContentStrategyGenerationStatus | undefined,
  doc: ContentStrategyDocument | undefined
): boolean {
  return generationStatus === "ready" && documentHasSubstance(doc);
}

export function formatContentStrategyForPrompt(doc: ContentStrategyDocument): string {
  const lines: string[] = [
    "CONTENT STRATEGY — editorial constitution. Do not violate. If a request conflicts, refuse rather than drift.",
    `North star: ${doc.north_star.what_we_are || "(unset)"}`,
    doc.north_star.what_we_sell ? `Sells: ${doc.north_star.what_we_sell}` : "",
    doc.north_star.commercial_goal ? `Commercial goal: ${doc.north_star.commercial_goal}` : "",
    doc.north_star.growth_priority ? `Growth priority: ${doc.north_star.growth_priority}` : "",
    `Audience: ${doc.audience.primary.who || "(unset)"}`,
    doc.audience.primary.situation ? `Situation: ${doc.audience.primary.situation}` : "",
    doc.audience.primary.jtbd ? `JTBD: ${doc.audience.primary.jtbd}` : "",
    doc.audience.awareness_stage ? `Awareness stage: ${doc.audience.awareness_stage}` : "",
    doc.positioning.statement ? `Positioning: ${doc.positioning.statement}` : "",
    doc.positioning.differentiation ? `Differentiation: ${doc.positioning.differentiation}` : "",
    doc.positioning.competitors.length
      ? `Competitors: ${doc.positioning.competitors.map((c) => c.name).join(", ")}`
      : "",
    doc.narrative.core_message ? `Core message: ${doc.narrative.core_message}` : "",
    doc.narrative.editorial_pov ? `Editorial POV: ${doc.narrative.editorial_pov}` : "",
    doc.narrative.claims_we_must_not_make.length
      ? `Must not claim: ${doc.narrative.claims_we_must_not_make.join("; ")}`
      : "",
    doc.content_franchise.pillars.length
      ? `Pillars: ${doc.content_franchise.pillars.map((p) => p.name).join(", ")}`
      : "",
    doc.voice.voice ? `Voice: ${doc.voice.voice}` : "",
    doc.voice.words_to_avoid.length ? `Words to avoid: ${doc.voice.words_to_avoid.join(", ")}` : "",
    doc.conversion.primary_cta ? `Primary CTA: ${doc.conversion.primary_cta}` : "",
    doc.guardrails.always.length ? `Always: ${doc.guardrails.always.join("; ")}` : "",
    doc.guardrails.never.length ? `Never: ${doc.guardrails.never.join("; ")}` : "",
  ];
  return lines.filter(Boolean).join("\n");
}

function flattenForDiff(doc: ContentStrategyDocument): Record<string, string> {
  const out: Record<string, string> = {
    "north_star.what_we_are": doc.north_star.what_we_are,
    "north_star.what_we_sell": doc.north_star.what_we_sell,
    "north_star.commercial_goal": doc.north_star.commercial_goal,
    "north_star.growth_priority": doc.north_star.growth_priority,
    "audience.primary.who": doc.audience.primary.who,
    "audience.primary.situation": doc.audience.primary.situation,
    "audience.primary.jtbd": doc.audience.primary.jtbd,
    "audience.awareness_stage": doc.audience.awareness_stage,
    "positioning.statement": doc.positioning.statement,
    "positioning.category": doc.positioning.category,
    "positioning.differentiation": doc.positioning.differentiation,
    "positioning.value_proposition": doc.positioning.value_proposition,
    "positioning.competitors": doc.positioning.competitors.map((c) => c.name).join(", "),
    "narrative.core_message": doc.narrative.core_message,
    "narrative.editorial_pov": doc.narrative.editorial_pov,
    "narrative.supporting_messages": doc.narrative.supporting_messages.join("; "),
    "narrative.claims_we_must_not_make": doc.narrative.claims_we_must_not_make.join("; "),
    "content_franchise.pillars": doc.content_franchise.pillars.map((p) => p.name).join(", "),
    "voice.voice": doc.voice.voice,
    "voice.personality": doc.voice.personality,
    "voice.words_to_avoid": doc.voice.words_to_avoid.join(", "),
    "conversion.primary_cta": doc.conversion.primary_cta,
    "conversion.desired_action": doc.conversion.desired_action,
    "guardrails.always": doc.guardrails.always.join("; "),
    "guardrails.never": doc.guardrails.never.join("; "),
    "measurement.content_kpis": doc.measurement.content_kpis.join("; "),
    "measurement.business_outcomes": doc.measurement.business_outcomes.join("; "),
  };
  return out;
}

export function diffContentStrategyDocuments(
  before: ContentStrategyDocument,
  after: ContentStrategyDocument
): Array<{ field: string; before: string; after: string }> {
  const a = flattenForDiff(before);
  const b = flattenForDiff(after);
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const changes: Array<{ field: string; before: string; after: string }> = [];
  for (const key of keys) {
    const left = (a[key] ?? "").trim();
    const right = (b[key] ?? "").trim();
    if (left !== right) {
      changes.push({ field: key, before: left || "(empty)", after: right || "(empty)" });
    }
  }
  return changes;
}

export function formatContentStrategyDiff(before: ContentStrategyDocument, after: ContentStrategyDocument): string {
  const changes = diffContentStrategyDocuments(before, after);
  if (!changes.length) {
    return "Proposed Content Strategy update:\n- (no field changes detected)\n\nApprove to apply, or reject to keep the current strategy.";
  }
  const lines = ["Proposed Content Strategy update (before → after):"];
  for (const change of changes.slice(0, 20)) {
    lines.push(`- ${change.field}:`);
    lines.push(`    before: ${change.before}`);
    lines.push(`    after: ${change.after}`);
  }
  if (changes.length > 20) {
    lines.push(`- …and ${changes.length - 20} more field(s)`);
  }
  lines.push("", "Approve to apply, or reject to keep the current strategy.");
  return lines.join("\n");
}

export function averageSectionConfidence(map: ContentStrategySectionConfidenceMap | undefined): number {
  const values = Object.values(map ?? {})
    .map((s) => s.confidence)
    .filter((n) => Number.isFinite(n));
  if (!values.length) return 0.4;
  return Math.min(1, Math.max(0, values.reduce((a, b) => a + b, 0) / values.length));
}

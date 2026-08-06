import {
  coerceContentArchetype,
  globalBannedRegister,
  structureRulesForArchetype,
  type ContentArchetype,
  type ResearchNeed,
} from "./content-archetype";

export const STYLE_VARIANTS = [
  "operator_checklist",
  "coach_walkthrough",
  "war_story_howto",
  "curated_survey",
  "ranked_picks",
  "criteria_debate",
  "buyer_brief",
  "customer_hero",
  "polemic",
  "framework_essay",
  "field_manual",
] as const;

export type StyleVariant = (typeof STYLE_VARIANTS)[number];

export type LexiconPolicy = {
  reading_level: "grade6" | "grade8" | "grade10" | "expert";
  jargon_budget: "none" | "explain_once" | "assume_domain";
  banned_register: string[];
  preferred_register: string[];
  max_avg_syllables_per_word?: number;
};

export type ProseCraft = {
  sentence_rhythm: "short_punchy" | "mixed" | "long_expository";
  paragraph_max_sentences: number;
  opening_move: "scene" | "promise" | "verdict" | "tension" | "direct_step";
  evidence_mode: "none" | "anecdote" | "steps" | "metrics" | "citations" | "logic";
  pronoun_stance: "I" | "we" | "you" | "neutral";
  cta_policy: "none" | "soft" | "hard";
};

export type StyleProfile = {
  archetype: ContentArchetype;
  variant: StyleVariant;
  lexicon: LexiconPolicy;
  craft: ProseCraft;
  do_sentences: string[];
  dont_sentences: string[];
  section_voice_notes: string;
  research_needs: ResearchNeed[];
};

export type StyleProfileResolveInput = {
  archetype?: ContentArchetype | string;
  structure?: string;
  purpose?: string;
  variant?: StyleVariant | string;
  brand_voice?: string;
  audience?: string;
  tone?: string;
  personal_notes?: string;
  must_include?: string;
  must_avoid?: string;
  length_preset?: "short" | "medium" | "long" | "pillar";
  site_id?: string;
  topic?: string;
  /** ISO week seed override for tests */
  seed?: string;
};

const VARIANTS_BY_ARCHETYPE: Record<ContentArchetype, StyleVariant[]> = {
  how_to: ["operator_checklist", "coach_walkthrough", "war_story_howto"],
  listicle: ["curated_survey", "ranked_picks"],
  software_roundup: ["buyer_brief"],
  comparison: ["criteria_debate"],
  case_study: ["customer_hero"],
  definitive_guide: ["field_manual", "framework_essay"],
  thought_leadership: ["polemic", "framework_essay"],
  article: ["framework_essay", "coach_walkthrough"],
};

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function isoWeekKey(d = new Date()): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${week}`;
}

function pickVariant(
  archetype: ContentArchetype,
  input: StyleProfileResolveInput
): StyleVariant {
  const allowed = VARIANTS_BY_ARCHETYPE[archetype];
  if (input.variant && (STYLE_VARIANTS as readonly string[]).includes(input.variant)) {
    const v = input.variant as StyleVariant;
    if (allowed.includes(v)) return v;
  }

  const notes = `${input.personal_notes ?? ""} ${input.must_include ?? ""}`.toLowerCase();
  const audience = (input.audience ?? "").toLowerCase();

  if (archetype === "how_to") {
    if (/\b(i was|i tried|my team|we failed|war story|personal)\b/.test(notes)) return "war_story_howto";
    if (/\bchecklist|steps only|quick steps\b/.test(notes) || input.length_preset === "short") {
      return "operator_checklist";
    }
    if (/\bbeginner|new to|educate|explain\b/.test(audience) || /\bbeginner\b/.test(notes)) {
      return "coach_walkthrough";
    }
  }
  if (archetype === "listicle") {
    if (/\brank|best|top \d+\b/.test(notes) || /\bbest\b/.test(input.topic ?? "")) return "ranked_picks";
    return "curated_survey";
  }
  if (archetype === "thought_leadership") {
    if (/\bwron|myth|contrarian|stop |against\b/.test(notes) || /\bwron|myth\b/.test(input.topic ?? "")) {
      return "polemic";
    }
    return "framework_essay";
  }

  const seed =
    input.seed ?? `${input.site_id ?? "site"}|${input.topic ?? "topic"}|${isoWeekKey()}`;
  return allowed[hashSeed(seed) % allowed.length]!;
}

function proseFor(archetype: ContentArchetype, variant: StyleVariant): {
  lexicon: LexiconPolicy;
  craft: ProseCraft;
  do_sentences: string[];
  dont_sentences: string[];
  section_voice_notes: string;
  research_needs: ResearchNeed[];
} {
  const banned = globalBannedRegister();
  const baseNeeds = structureRulesForArchetype(archetype).default_research_needs;

  switch (variant) {
    case "operator_checklist":
      return {
        lexicon: {
          reading_level: "grade8",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["open", "click", "copy", "check", "if"],
        },
        craft: {
          sentence_rhythm: "short_punchy",
          paragraph_max_sentences: 2,
          opening_move: "direct_step",
          evidence_mode: "steps",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "Open Settings → Billing and copy the webhook URL.",
          "If the feed fails, check the last sync timestamp before retrying.",
        ],
        dont_sentences: [
          "It is important to configure your billing settings appropriately.",
          "Leveraging proper troubleshooting methodologies ensures success.",
        ],
        section_voice_notes:
          "Each H2 is an action. Body = do this, what done looks like, one pitfall. Minimal prose.",
        research_needs: ["steps_ui_paths"],
      };
    case "coach_walkthrough":
      return {
        lexicon: {
          reading_level: "grade8",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["first", "then", "because", "watch for"],
        },
        craft: {
          sentence_rhythm: "mixed",
          paragraph_max_sentences: 3,
          opening_move: "promise",
          evidence_mode: "steps",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "You'll set up the chart of accounts first so later imports map cleanly.",
          "Watch for duplicate categories — merge them before you connect the bank feed.",
        ],
        dont_sentences: [
          "Understanding the foundational concepts is crucial before proceeding.",
          "In today's world, proper setup transforms your workflow.",
        ],
        section_voice_notes: "Short why → then do; one pitfall per step. No standalone What Is H2.",
        research_needs: ["steps_ui_paths", "prerequisites_myths"],
      };
    case "war_story_howto":
      return {
        lexicon: {
          reading_level: "grade8",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["I", "we", "broke", "fixed"],
        },
        craft: {
          sentence_rhythm: "mixed",
          paragraph_max_sentences: 3,
          opening_move: "scene",
          evidence_mode: "anecdote",
          pronoun_stance: "I",
          cta_policy: "soft",
        },
        do_sentences: [
          "The feed failed at 2am — the timestamp showed the last sync was three days stale.",
          "Here's the exact fix we used, step by step.",
        ],
        dont_sentences: [
          "Our seamless journey to success began with leveraging best practices.",
          "This transformative experience taught invaluable lessons.",
        ],
        section_voice_notes: "Scene → what broke → fix as steps. Prefer user notes over web fluff.",
        research_needs: ["lived_user_words", "steps_ui_paths"],
      };
    case "curated_survey":
      return {
        lexicon: {
          reading_level: "grade8",
          jargon_budget: "explain_once",
          banned_register: [...banned, "in today's world"],
          preferred_register: ["for", "useful when", "skip if"],
        },
        craft: {
          sentence_rhythm: "short_punchy",
          paragraph_max_sentences: 3,
          opening_move: "promise",
          evidence_mode: "citations",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "Batch your deep work before noon — that's when most people still have decision fuel.",
          "Skip this if you already time-block; it's the same idea with a different name.",
        ],
        dont_sentences: [
          "Deep work is a powerful productivity technique that can transform your workflow.",
          "In today's world, focus is more important than ever.",
        ],
        section_voice_notes: "H2 = item. Name it, who it's for, one proof. Parallel depth across items.",
        research_needs: ["option_inventory"],
      };
    case "ranked_picks":
      return {
        lexicon: {
          reading_level: "grade8",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["ranked", "wins on", "loses on"],
        },
        craft: {
          sentence_rhythm: "short_punchy",
          paragraph_max_sentences: 3,
          opening_move: "verdict",
          evidence_mode: "citations",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "We ranked these by setup time and SSO support — #1 wins if you need audit logs.",
          "If offline mode matters more, skip to #4.",
        ],
        dont_sentences: [
          "All of these tools are great in their own way.",
          "Choosing the right option depends on your unique needs.",
        ],
        section_voice_notes: "State ranking logic in intro. Stronger verbs on #1. Parallel item depth.",
        research_needs: ["option_inventory", "evaluation_criteria"],
      };
    case "buyer_brief":
      return {
        lexicon: {
          reading_level: "grade10",
          jargon_budget: "assume_domain",
          banned_register: [...banned, "cutting-edge", "innovative"],
          preferred_register: ["best for", "weak if", "pricing"],
        },
        craft: {
          sentence_rhythm: "mixed",
          paragraph_max_sentences: 3,
          opening_move: "verdict",
          evidence_mode: "citations",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "Best for teams that need SSO and audit logs; weak if you need offline mode.",
          "Pricing starts at $29/user — confirm seat minimums before you pilot.",
        ],
        dont_sentences: [
          "This innovative platform offers a comprehensive suite of cutting-edge features.",
          "A robust ecosystem ensures seamless collaboration.",
        ],
        section_voice_notes: "Tool-name H2s. Same order: features → pricing → pros/cons → best for.",
        research_needs: ["evaluation_criteria", "pricing_features", "option_inventory"],
      };
    case "criteria_debate":
      return {
        lexicon: {
          reading_level: "grade10",
          jargon_budget: "assume_domain",
          banned_register: banned,
          preferred_register: ["wins on", "loses on", "depends on"],
        },
        craft: {
          sentence_rhythm: "mixed",
          paragraph_max_sentences: 3,
          opening_move: "verdict",
          evidence_mode: "logic",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "Notion wins on flexible databases; Confluence wins on permissioned enterprise spaces.",
          "Pick X if your budget owner is IT; pick Y if individual teams buy.",
        ],
        dont_sentences: [
          "Both tools have their strengths and weaknesses depending on your needs.",
          "It depends — every organization is different.",
        ],
        section_voice_notes: "H2s = criteria. Side-by-side in each section. Early table + recommendation.",
        research_needs: ["evaluation_criteria", "pricing_features", "counterarguments"],
      };
    case "customer_hero":
      return {
        lexicon: {
          reading_level: "grade8",
          jargon_budget: "explain_once",
          banned_register: [...banned, "delighted", "thrilled", "seamless journey"],
          preferred_register: ["after", "dropped", "rose", "they"],
        },
        craft: {
          sentence_rhythm: "mixed",
          paragraph_max_sentences: 3,
          opening_move: "tension",
          evidence_mode: "metrics",
          pronoun_stance: "neutral",
          cta_policy: "soft",
        },
        do_sentences: [
          "After six weeks, support tickets about onboarding dropped from 40/week to 12.",
          "The team kept their existing CRM; the change was the intake form, not a rip-and-replace.",
        ],
        dont_sentences: [
          "The client achieved remarkable results by leveraging our solution.",
          "They were delighted with the seamless journey to success.",
        ],
        section_voice_notes:
          "Customer is hero. Headers state problem/approach/outcome. Never invent metrics.",
        research_needs: ["metrics_outcomes", "lived_user_words"],
      };
    case "field_manual":
      return {
        lexicon: {
          reading_level: "grade10",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["three models", "pick based on", "tradeoff"],
        },
        craft: {
          sentence_rhythm: "long_expository",
          paragraph_max_sentences: 4,
          opening_move: "promise",
          evidence_mode: "citations",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "Three pricing models dominate B2B SaaS; pick based on who controls the budget.",
          "Treat each major subtopic as if it could stand alone — then link deeper.",
        ],
        dont_sentences: [
          "Understanding pricing is crucial for success in today's competitive landscape.",
          "This definitive guide will cover everything you need to know.",
        ],
        section_voice_notes: "MECE H2s. Exhaustive treatment. No vague -ing headers.",
        research_needs: ["subtopic_coverage", "counterarguments"],
      };
    case "polemic":
      return {
        lexicon: {
          reading_level: "grade10",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["most", "wrong", "instead"],
        },
        craft: {
          sentence_rhythm: "short_punchy",
          paragraph_max_sentences: 3,
          opening_move: "tension",
          evidence_mode: "logic",
          pronoun_stance: "I",
          cta_policy: "none",
        },
        do_sentences: [
          "Most 'AI content strategies' are publishing calendars with a chatbot stapled on.",
          "The useful question isn't 'how do we publish more' — it's 'what should we stop saying.'",
        ],
        dont_sentences: [
          "AI is transforming the content landscape in unprecedented ways.",
          "It's important to consider multiple perspectives in today's world.",
        ],
        section_voice_notes: "Thesis first. Each H2 advances the argument. Name the counterargument.",
        research_needs: ["counterarguments"],
      };
    case "framework_essay":
    default:
      return {
        lexicon: {
          reading_level: "grade10",
          jargon_budget: "explain_once",
          banned_register: banned,
          preferred_register: ["framework", "step", "tradeoff"],
        },
        craft: {
          sentence_rhythm: "mixed",
          paragraph_max_sentences: 3,
          opening_move: "promise",
          evidence_mode: "logic",
          pronoun_stance: "you",
          cta_policy: "soft",
        },
        do_sentences: [
          "Name the model in the first screen: three lenses, one decision rule.",
          "If a section doesn't change the reader's position, cut it.",
        ],
        dont_sentences: [
          "In this article, we will explore various aspects of the topic.",
          "There are many factors to consider when thinking about this.",
        ],
        section_voice_notes: "Headers advance a named framework. Evidence then implication.",
        research_needs: baseNeeds,
      };
  }
}

export function resolveStyleProfile(input: StyleProfileResolveInput): StyleProfile {
  const archetype =
    coerceContentArchetype(input.archetype) ||
    coerceContentArchetype(input.structure) ||
    coerceContentArchetype(input.purpose) ||
    "article";

  const variant = pickVariant(archetype, input);
  const base = proseFor(archetype, variant);

  const banned = new Set(base.lexicon.banned_register);
  for (const part of (input.must_avoid ?? "").split(/[,;\n]+/)) {
    const t = part.trim().toLowerCase();
    if (t) banned.add(t);
  }

  const preferred = [...base.lexicon.preferred_register];
  if (input.brand_voice?.trim()) preferred.push(input.brand_voice.trim().slice(0, 80));
  if (input.tone?.trim()) preferred.push(input.tone.trim());

  let reading_level = base.lexicon.reading_level;
  const aud = (input.audience ?? "").toLowerCase();
  if (/\bbeginner|consumer|general\b/.test(aud)) reading_level = "grade8";
  if (/\bexpert|engineer|technical|developer\b/.test(aud)) reading_level = "expert";

  const research_needs =
    variant === "war_story_howto" || input.personal_notes?.trim()
      ? Array.from(new Set<ResearchNeed>(["lived_user_words", ...base.research_needs]))
      : base.research_needs;

  return {
    archetype,
    variant,
    lexicon: {
      ...base.lexicon,
      reading_level,
      banned_register: Array.from(banned),
      preferred_register: preferred,
    },
    craft: base.craft,
    do_sentences: base.do_sentences,
    dont_sentences: base.dont_sentences,
    section_voice_notes: base.section_voice_notes,
    research_needs,
  };
}

/** Prompt block injected into outline/draft. */
export function formatStyleProfileForPrompt(profile: StyleProfile): string {
  return `STYLE PROFILE
Archetype: ${profile.archetype} | Variant: ${profile.variant}
Stance: ${profile.craft.pronoun_stance} | Opening: ${profile.craft.opening_move} | Evidence: ${profile.craft.evidence_mode}
Reading level: ${profile.lexicon.reading_level} | Jargon: ${profile.lexicon.jargon_budget}
Rhythm: ${profile.craft.sentence_rhythm}; max ${profile.craft.paragraph_max_sentences} sentences per paragraph
CTA policy: ${profile.craft.cta_policy}
Banned phrases: ${profile.lexicon.banned_register.slice(0, 12).join(", ")}
Preferred register: ${profile.lexicon.preferred_register.slice(0, 8).join(", ")}
Good sentence examples:
${profile.do_sentences.map((s) => `- ${s}`).join("\n")}
Bad sentence examples (do not imitate):
${profile.dont_sentences.map((s) => `- ${s}`).join("\n")}
Section voice: ${profile.section_voice_notes}
Research needs: ${profile.research_needs.join(", ")}`;
}

import { coerceContentArchetype, type ContentArchetype } from "./content-archetype";
import type { StyleProfile } from "./style-profile";

export type ResearchScope =
  | { kind: "named_entity"; entity: string; disambiguators: string[] }
  | { kind: "class_example"; class_label: string; exemplar_ok: true }
  | { kind: "general_topic"; topic: string }
  | { kind: "brand_owned"; topic: string };

export type ResearchBrief = {
  raw_topic: string;
  scope: ResearchScope;
  reader_job: string;
  archetype_hint?: ContentArchetype;
  must_answer: string[];
  must_not_invent: string[];
  ambiguity: {
    is_ambiguous: boolean;
    clarifying_question?: string;
    options?: string[];
  };
  first_party_reuse: {
    avoid_duplicate_angles: string[];
    style_exemplar_post_ids: string[];
    winning_patterns: string[];
  };
  search_queries: string[];
};

export type FirstPartyPriors = {
  avoid_duplicate_angles: string[];
  style_exemplar_post_ids: string[];
  winning_patterns: string[];
  style_snippets: string[];
  comment_questions: string[];
};

export type BuildResearchBriefInput = {
  topic: string;
  audience?: string;
  archetype?: ContentArchetype | string;
  style_profile?: StyleProfile;
  personal_notes?: string;
  must_include?: string;
  resolved_scope?: ResearchScope;
  /** User picked a clarify option text */
  clarify_choice?: string;
  first_party?: FirstPartyPriors;
  /** Soften clarify for quick_draft */
  allow_guess?: boolean;
};

const VAGUE_TOPIC_RE =
  /^(?:write\s+(?:a\s+)?(?:post|blog|article)\s+about\s+)?(?:a|an|the|some)\s+\w+(?:\s+\w+){0,3}$/i;
const NAMED_PERSON_HINT =
  /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b|\b(timothy treadwell|grizzly man)\b/i;

function scopeSearchTopic(scope: ResearchScope): string {
  switch (scope.kind) {
    case "named_entity":
      return [scope.entity, ...scope.disambiguators].filter(Boolean).join(" ");
    case "class_example":
      return scope.class_label;
    case "general_topic":
    case "brand_owned":
      return scope.topic;
  }
}

function detectAmbiguity(topic: string): ResearchBrief["ambiguity"] & { tentative?: ResearchScope } {
  const t = topic.trim();
  const lower = t.toLowerCase();

  // "a man that fights bears" / "men who fight bears" → class vs named
  if (/\b(a|an|the|some)\s+(man|woman|person|people|men|women)\b/.test(lower) || /\bwho (fight|fights|fought)\b/.test(lower)) {
    const classLabel = t.replace(/^write\s+(a\s+)?(post|blog|article)\s+about\s+/i, "").trim();
    return {
      is_ambiguous: true,
      clarifying_question: `Is "${classLabel}" about a specific person, the general phenomenon, or a fictional/composite example?`,
      options: [
        "A specific named person (tell me who)",
        "The general topic / phenomenon",
        "A fictional or composite example",
      ],
      tentative: { kind: "class_example", class_label: classLabel, exemplar_ok: true },
    };
  }

  if (VAGUE_TOPIC_RE.test(t) || /^(?:a|an)\s+\w+$/i.test(t)) {
    return {
      is_ambiguous: true,
      clarifying_question: `Which angle should we research for "${t}" — a specific named subject, or the topic in general?`,
      options: ["A specific named subject (tell me who/what)", "The topic in general"],
      tentative: { kind: "general_topic", topic: t },
    };
  }

  const named = t.match(NAMED_PERSON_HINT);
  if (named && named[1] && named[1].split(/\s+/).length >= 2) {
    return {
      is_ambiguous: false,
      tentative: { kind: "named_entity", entity: named[1], disambiguators: [] },
    };
  }

  return {
    is_ambiguous: false,
    tentative: { kind: "general_topic", topic: t },
  };
}

function applyClarifyChoice(topic: string, choice: string, prior?: ResearchScope): ResearchScope {
  const c = choice.toLowerCase();
  if (/specific|named|tell me who/.test(c)) {
    const entityMatch = choice.match(/:\s*(.+)$/) || choice.match(/\(([^)]+)\)/);
    const entity = entityMatch?.[1]?.trim() || topic;
    return { kind: "named_entity", entity, disambiguators: [] };
  }
  if (/general|phenomenon|topic in general/.test(c)) {
    return { kind: "general_topic", topic };
  }
  if (/fictional|composite|class|example/.test(c)) {
    return { kind: "class_example", class_label: topic, exemplar_ok: true };
  }
  return prior ?? { kind: "general_topic", topic };
}

function buildMustAnswer(
  scope: ResearchScope,
  archetype: ContentArchetype | undefined,
  profile: StyleProfile | undefined,
  commentQuestions: string[]
): string[] {
  const topic = scopeSearchTopic(scope);
  const qs: string[] = [];

  if (scope.kind === "named_entity") {
    qs.push(`Who is ${scope.entity} and what are they known for?`);
    qs.push(`What verified facts exist about ${scope.entity}?`);
    qs.push(`What controversies or counterpoints surround ${scope.entity}?`);
  } else if (scope.kind === "class_example") {
    qs.push(`What defines the phenomenon: ${scope.class_label}?`);
    qs.push(`What notable examples illustrate ${scope.class_label} without crowning one as the only answer?`);
    qs.push(`What risks or myths should a reader know?`);
  } else if (scope.kind === "brand_owned") {
    qs.push(`What concrete details did the user share about ${topic}?`);
  } else {
    qs.push(`What should a reader know first about ${topic}?`);
  }

  const needs = profile?.research_needs ?? [];
  if (needs.includes("steps_ui_paths")) qs.push(`What are the concrete steps or UI paths for ${topic}?`);
  if (needs.includes("prerequisites_myths")) qs.push(`What prerequisites and common mistakes exist for ${topic}?`);
  if (needs.includes("option_inventory")) qs.push(`What options or items belong in a fair survey of ${topic}?`);
  if (needs.includes("evaluation_criteria")) qs.push(`What criteria should be used to evaluate ${topic}?`);
  if (needs.includes("pricing_features")) qs.push(`What pricing and feature facts are current for ${topic}?`);
  if (needs.includes("metrics_outcomes")) qs.push(`What measurable outcomes or case results exist for ${topic}?`);
  if (needs.includes("counterarguments")) qs.push(`What strong counterarguments exist against common claims about ${topic}?`);
  if (needs.includes("subtopic_coverage")) qs.push(`What major subtopics must a comprehensive piece on ${topic} cover?`);

  if (archetype === "comparison") qs.push(`How do the leading options for ${topic} compare dimension by dimension?`);
  if (archetype === "how_to") qs.push(`What does "done" look like after completing ${topic}?`);

  for (const cq of commentQuestions.slice(0, 3)) {
    qs.push(cq);
  }

  return Array.from(new Set(qs)).slice(0, 8);
}

function buildQueries(scope: ResearchScope, archetype: ContentArchetype | undefined, mustAnswer: string[]): string[] {
  const topic = scopeSearchTopic(scope);
  const queries: string[] = [topic];

  switch (archetype) {
    case "how_to":
      queries.push(`${topic} steps`, `${topic} common mistakes`);
      break;
    case "comparison":
      queries.push(`${topic} vs`, `${topic} comparison pricing`);
      break;
    case "software_roundup":
      queries.push(`best ${topic} tools`, `${topic} pricing features`);
      break;
    case "case_study":
      queries.push(`${topic} case study results`, `${topic} outcomes metrics`);
      break;
    case "thought_leadership":
      queries.push(`criticism of ${topic}`, `why ${topic} fails`);
      break;
    case "definitive_guide":
      queries.push(`${topic} overview guide`, `${topic} frameworks`, `${topic} limitations`);
      break;
    case "listicle":
      queries.push(`${topic} examples`, `types of ${topic}`);
      break;
    default:
      queries.push(`${topic} overview`);
  }

  if (scope.kind === "named_entity" && scope.disambiguators.length) {
    queries[0] = `${scope.entity} ${scope.disambiguators.join(" ")}`;
  }
  if (scope.kind === "class_example") {
    queries.push(`${topic} examples`, `${topic} history`);
  }

  // Tie one query to an unanswered research question wording
  if (mustAnswer[1]) queries.push(mustAnswer[1].replace(/\?$/, ""));

  return Array.from(new Set(queries.map((q) => q.trim()).filter(Boolean))).slice(0, 6);
}

/**
 * Deterministic ResearchBrief (Phase-1). Clarifies ambiguous topics before search.
 */
export function buildResearchBrief(input: BuildResearchBriefInput): ResearchBrief {
  const raw = input.topic.trim();
  const archetype =
    coerceContentArchetype(input.archetype) || input.style_profile?.archetype || undefined;
  const fp = input.first_party ?? {
    avoid_duplicate_angles: [],
    style_exemplar_post_ids: [],
    winning_patterns: [],
    style_snippets: [],
    comment_questions: [],
  };

  if (input.personal_notes?.trim() && !input.resolved_scope && /personal|my story|i was|lived/i.test(input.personal_notes)) {
    const scope: ResearchScope = { kind: "brand_owned", topic: raw };
    const must_answer = buildMustAnswer(scope, archetype, input.style_profile, fp.comment_questions);
    return {
      raw_topic: raw,
      scope,
      reader_job: `Understand a lived account of ${raw}`,
      archetype_hint: archetype,
      must_answer,
      must_not_invent: ["statistics", "named third parties not in user notes", "lessons user did not state"],
      ambiguity: { is_ambiguous: false },
      first_party_reuse: {
        avoid_duplicate_angles: fp.avoid_duplicate_angles,
        style_exemplar_post_ids: fp.style_exemplar_post_ids,
        winning_patterns: fp.winning_patterns,
      },
      search_queries: [],
    };
  }

  let ambiguity = detectAmbiguity(raw);
  let scope: ResearchScope =
    input.resolved_scope ||
    (input.clarify_choice
      ? applyClarifyChoice(raw, input.clarify_choice, ambiguity.tentative)
      : ambiguity.tentative) ||
    { kind: "general_topic", topic: raw };

  if (input.clarify_choice) {
    ambiguity = { is_ambiguous: false };
  } else if (ambiguity.is_ambiguous && input.allow_guess) {
    // quick_draft: guess general/class, disclose later
    scope = ambiguity.tentative || scope;
    ambiguity = {
      is_ambiguous: false,
      clarifying_question: ambiguity.clarifying_question,
      options: ambiguity.options,
    };
  }

  const must_answer = buildMustAnswer(scope, archetype, input.style_profile, fp.comment_questions);
  const search_queries =
    scope.kind === "brand_owned" || (ambiguity.is_ambiguous && !input.allow_guess)
      ? []
      : buildQueries(scope, archetype, must_answer);

  return {
    raw_topic: raw,
    scope,
    reader_job: `Get a clear, scoped answer about ${scopeSearchTopic(scope)}`,
    archetype_hint: archetype,
    must_answer,
    must_not_invent: [
      "unsourced statistics",
      scope.kind === "class_example" ? "crowning one random person as the subject" : "fabricated quotes",
    ],
    ambiguity: {
      is_ambiguous: Boolean(ambiguity.is_ambiguous && !input.clarify_choice && !input.allow_guess),
      clarifying_question: ambiguity.clarifying_question,
      options: ambiguity.options,
    },
    first_party_reuse: {
      avoid_duplicate_angles: fp.avoid_duplicate_angles,
      style_exemplar_post_ids: fp.style_exemplar_post_ids,
      winning_patterns: fp.winning_patterns,
    },
    search_queries,
  };
}

export function formatResearchBriefForPrompt(brief: ResearchBrief): string {
  const scopeLine =
    brief.scope.kind === "named_entity"
      ? `named_entity | ${brief.scope.entity} | ${brief.scope.disambiguators.join(", ")}`
      : brief.scope.kind === "class_example"
        ? `class_example | ${brief.scope.class_label}`
        : `${brief.scope.kind} | ${"topic" in brief.scope ? brief.scope.topic : ""}`;

  return `RESEARCH SCOPE: ${scopeLine}
READER JOB: ${brief.reader_job}
MUST ANSWER:
${brief.must_answer.map((q, i) => `- Q${i + 1}: ${q}`).join("\n")}
MUST NOT INVENT: ${brief.must_not_invent.join("; ")}
AVOID DUPLICATE ANGLES: ${brief.first_party_reuse.avoid_duplicate_angles.join("; ") || "(none)"}
WINNING PATTERNS (soft): ${brief.first_party_reuse.winning_patterns.join("; ") || "(none)"}`;
}

export function researchTopicFromBrief(brief: ResearchBrief): string {
  return scopeSearchTopic(brief.scope);
}

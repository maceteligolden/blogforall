import type { ResearchNeed } from "./content-archetype";
import type { StyleProfile } from "./style-profile";

export type RoutableNote = {
  id?: string;
  url?: string;
  title: string;
  snippet: string;
  source?: "web" | "extract" | "user" | "first_party" | "kb";
  need_tags?: ResearchNeed[];
  question_id?: string;
  claim?: string;
};

export type ScoredNote = RoutableNote & { score: number; reasons: string[] };

const NEED_KEYWORDS: Record<ResearchNeed, RegExp> = {
  steps_ui_paths: /\b(step|click|open|settings|how to|configure|install|setup|ui)\b/i,
  prerequisites_myths: /\b(prerequisite|before you|mistake|myth|common error|pitfall|watch out)\b/i,
  option_inventory: /\b(options|alternatives|examples|types of|list of|including)\b/i,
  evaluation_criteria: /\b(criteria|evaluate|compare|vs|versus|pros|cons|best for)\b/i,
  pricing_features: /\b(pricing|price|\$|features|plan|per user|free tier)\b/i,
  metrics_outcomes: /\b(\d+%|\d+\s*%|increased|decreased|reduced|roi|conversion|tickets|revenue)\b/i,
  counterarguments: /\b(however|critics|drawback|limit|fail|wrong|contrary|debate)\b/i,
  subtopic_coverage: /\b(overview|framework|types|components|history|future)\b/i,
  lived_user_words: /\b(i |we |my |our )\b/i,
};

/**
 * Score and filter research notes for the active StyleProfile.
 * Always promotes user / first_party / kb notes above anonymous web snippets.
 */
export function routeResearchNotes(
  notes: RoutableNote[],
  profile: StyleProfile,
  opts?: { maxKeep?: number; mustInclude?: string; personalNotes?: string }
): ScoredNote[] {
  const maxKeep = opts?.maxKeep ?? 8;
  const needs = new Set(profile.research_needs);
  const must = (opts?.mustInclude ?? "").toLowerCase();
  const personal = (opts?.personalNotes ?? "").trim();

  const scored: ScoredNote[] = notes.map((n, i) => {
    const text = `${n.title} ${n.snippet} ${n.claim ?? ""}`;
    const reasons: string[] = [];
    let score = 0.2;

    if (n.source === "user" || n.source === "first_party") {
      score += 2;
      reasons.push("first_party_or_user");
    } else if (n.source === "kb") {
      score += 1.5;
      reasons.push("knowledge_base");
    } else if (n.source === "extract") {
      score += 0.6;
      reasons.push("extracted");
    }

    const tags = n.need_tags?.length
      ? n.need_tags
      : (Object.keys(NEED_KEYWORDS) as ResearchNeed[]).filter((need) => NEED_KEYWORDS[need].test(text));

    for (const tag of tags) {
      if (needs.has(tag)) {
        score += 1;
        reasons.push(`need:${tag}`);
      } else if (tag === "lived_user_words" && personal) {
        score += 0.5;
      } else {
        score -= 0.15;
      }
    }

    // Drop thought-leadership essays from buyer roundups
    if (
      (profile.archetype === "software_roundup" || profile.archetype === "comparison") &&
      /\b(thought leadership|transforming the|landscape)\b/i.test(text) &&
      !/\b(pricing|feature|\$)\b/i.test(text)
    ) {
      score -= 1.2;
      reasons.push("puff_penalty");
    }

    if (must && text.toLowerCase().includes(must.slice(0, 40))) {
      score += 1.5;
      reasons.push("must_include_match");
    }

    if (n.question_id) {
      score += 0.4;
      reasons.push("question_linked");
    }

    // Slight recency-unaware diversity: prefer later unique urls lightly
    score += Math.min(0.1, i * 0.01);

    return { ...n, need_tags: tags, score, reasons };
  });

  // Always inject personal notes as a synthetic note when present
  if (personal) {
    scored.push({
      id: "user_notes",
      title: "Author notes",
      snippet: personal.slice(0, 2000),
      source: "user",
      need_tags: ["lived_user_words"],
      score: 5,
      reasons: ["personal_notes"],
    });
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((n) => n.score > 0).slice(0, maxKeep);
}

export function formatRoutedNotesForPrompt(notes: ScoredNote[]): string {
  if (!notes.length) return "(no routed research notes)";
  return notes
    .map((n, i) => {
      const claim = n.claim ? `Claim: ${n.claim}\n` : "";
      const q = n.question_id ? `Q: ${n.question_id}\n` : "";
      return `[${i + 1}] ${n.title}${n.url ? `\nURL: ${n.url}` : ""}\n${q}${claim}${n.snippet}`.trim();
    })
    .join("\n\n");
}

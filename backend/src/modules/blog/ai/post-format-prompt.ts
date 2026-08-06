/** Draft-prompt helpers for post_format (voice) and content_archetype (Animalz shape). */

import { coerceContentArchetype, outlinePromptForArchetype } from "./contracts/content-archetype";
import { formatStyleProfileForPrompt, resolveStyleProfile, type StyleProfile } from "./contracts/style-profile";
import { formatResearchBriefForPrompt, type ResearchBrief } from "./contracts/research-brief";

function isPersonalVoiceFormat(format?: string): boolean {
  return format === "personal_story" || format === "linkedin_post";
}

export function draftRoleInstructions(format?: string, archetype?: string): string {
  switch (format) {
    case "personal_story":
      return `You are ghostwriting a first-person personal essay in the user's voice for general readers.
Match their diction and concrete details. Short scenes over abstractions. No stock motivational closings.
Do not invent meaning, metaphors, or lessons the user did not state.`;
    case "engineering_reflection":
      return `You are ghostwriting a first-person reflection that may touch engineering only when the user made that link.
Separate lived scenes from interpretation. Never invent metaphors or morals. Leave ambiguity if the user left it.`;
    case "linkedin_post":
      return `You are ghostwriting a short first-person LinkedIn-style post in the user's voice.
Punchy, scannable, concrete. No corporate fluff or invented lessons.`;
    case "productivity":
      return `You are a practical blogger writing a useful, evidence-aware article.
Stay faithful to the user's request; avoid invented case studies.`;
    default:
      break;
  }

  const a = coerceContentArchetype(archetype);
  switch (a) {
    case "how_to":
      return `You are writing a how-to. H2s are action steps. No "What Is" section. Prefer verbs and concrete UI/actions.`;
    case "listicle":
      return `You are writing a listicle. H2s are the list items. Parallel depth. Title count must match item count.`;
    case "software_roundup":
      return `You are writing a software roundup. Tool-name H2s; features → pricing → pros/cons → best for. Early criteria + table.`;
    case "comparison":
      return `You are writing an X vs Y comparison. H2s are criteria, not product names. Early verdict table. Be decisive with evidence.`;
    case "case_study":
      return `You are writing a case study. Customer is the hero. Problem → approach → outcome with real numbers when provided — never invent metrics.`;
    case "definitive_guide":
      return `You are writing a definitive guide. MECE subtopics, exhaustive treatment. Do not claim "definitive" unless coverage warrants it.`;
    case "thought_leadership":
      return `You are writing thought leadership. Thesis first; each section advances the argument; acknowledge counterarguments.`;
    default:
      return `You are writing a blog post faithful to the user's request and lived words.
Prefer concrete detail over generic expert-blogger filler. Do not invent meaning the user did not state.`;
  }
}

export function emptyResearchGuidance(format?: string): string {
  if (isPersonalVoiceFormat(format)) {
    return `No web research results were returned. Write ONLY from the USER REQUEST / lived words above. Do not invent meaning, external lessons, statistics, or metaphors. Do not fill gaps with general knowledge morals.`;
  }
  return `No web research results were returned. Write from general knowledge and avoid specific recent statistics or news unless widely known. Do not invent citations.`;
}

export function buildStyleAwareDraftPreamble(opts: {
  postFormat?: string;
  styleProfile?: StyleProfile;
  researchBrief?: ResearchBrief;
  contentArchetype?: string;
}): string {
  const profile =
    opts.styleProfile ||
    resolveStyleProfile({
      archetype: opts.contentArchetype,
      topic: opts.researchBrief?.raw_topic,
    });
  const parts = [
    draftRoleInstructions(opts.postFormat, profile.archetype),
    formatStyleProfileForPrompt(profile),
    outlinePromptForArchetype(profile.archetype),
  ];
  if (opts.researchBrief) {
    parts.push(formatResearchBriefForPrompt(opts.researchBrief));
  }
  return parts.join("\n\n");
}

/** Draft-prompt helpers for post_format (kept in blog module to avoid orchestrator→blog cycle). */

function isPersonalVoiceFormat(format?: string): boolean {
  return format === "personal_story" || format === "linkedin_post";
}

export function draftRoleInstructions(format?: string): string {
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

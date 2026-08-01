/**
 * Writing skill guard — ADR-004 / doc 06.
 * Draft paths require a Research Package id; Writing never owns web search.
 */
export function assertWritingMayProceed(input: {
  research_package_id?: string;
  allow_without_package?: boolean;
}): void {
  if (input.allow_without_package) return;
  if (!input.research_package_id) {
    throw new Error(
      "Writing requires research_package_id. Schedule Research skill first; Writing must not search the web."
    );
  }
}

/** Explicit deny-list for tools Writing must never receive. */
export const WRITING_FORBIDDEN_TOOLS = ["search.web", "tavily.search"] as const;

/**
 * Supervisor-only tools that embed research inside the writer (Tavily in BlogGraph).
 * Allowed when ORCHESTRATOR_V05_GRAPH_ENABLED is false; forbidden on the v0.5 Writing skill path.
 */
export const LEGACY_WRITER_RESEARCH_TOOLS = ["blogs.generateDraft"] as const;

/** BlogGraph methods that perform writer-embedded research — Writing skill must not call these. */
export const WRITING_FORBIDDEN_BLOG_GRAPH_METHODS = ["generateFull", "generateWithReview", "streamGenerate"] as const;

export function writingToolAllowlist(allToolNames: string[]): string[] {
  const forbidden = new Set<string>([...WRITING_FORBIDDEN_TOOLS, ...LEGACY_WRITER_RESEARCH_TOOLS]);
  return allToolNames.filter((n) => !forbidden.has(n));
}

export function isLegacyWriterResearchTool(toolName: string): boolean {
  return (LEGACY_WRITER_RESEARCH_TOOLS as readonly string[]).includes(toolName);
}

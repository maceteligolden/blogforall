/**
 * MVP locks from docs/architecture/v0.5/14-mvp-and-roadmap.md (ADR-008).
 * Do not change without an ADR update.
 */
export const MVP_LOCKS = {
  coverageMin: 0.55,
  maxSkillsPerTurn: 5,
  optimizeOverallMin: 72,
  optimizeMaxLoops: 2,
  researchCoverageRetryMax: 1,
  researchSourcesLiteMax: 5,
  researchSourcesFullMax: 12,
} as const;

export type MvpLocks = typeof MVP_LOCKS;

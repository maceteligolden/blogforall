import type { ResearchClaim, ResearchDocument, ResearchSubquestion, SourceTier } from "./research.types";

const TIER1_HOSTS = [
  "gov",
  "edu",
  "arxiv.org",
  "ietf.org",
  "w3.org",
  "iso.org",
  "nist.gov",
  "docs.",
  "developer.",
  "learn.microsoft.com",
  "cloud.google.com",
  "aws.amazon.com",
  "platform.openai.com",
  "langchain.com",
  "postgresql.org",
];

const TIER3_HOSTS = [
  "reddit.com",
  "news.ycombinator.com",
  "stackoverflow.com",
  "stackexchange.com",
  "quora.com",
  "discourse.",
];

const TIER4_HINTS = ["listicle", "best-of", "top-10", "aggregator", "buzzfeed", "medium.com/@"];

export function classifySourceTier(url: string, title = ""): SourceTier {
  const hay = `${url} ${title}`.toLowerCase();
  if (
    TIER1_HOSTS.some((h) => hay.includes(h)) ||
    hay.includes("/docs") ||
    (hay.includes("github.com") && hay.includes("/blob"))
  ) {
    return 1;
  }
  if (
    TIER3_HOSTS.some((h) => hay.includes(h)) ||
    (hay.includes("github.com") && (hay.includes("/issues") || hay.includes("/discussions")))
  ) {
    return 3;
  }
  if (TIER4_HINTS.some((h) => hay.includes(h))) {
    return 4;
  }
  return 2;
}

export function scoreDocument(doc: {
  tier: SourceTier;
  relevance_score: number;
  snippet: string;
  extracted_text?: string;
}): number {
  const authority = { 1: 5, 2: 4, 3: 2, 4: 1 }[doc.tier] / 5;
  const relevance = Math.min(1, Math.max(0, doc.relevance_score));
  const recency = 0.7;
  const primaryEvidence = doc.tier === 1 ? 1 : doc.extracted_text && doc.extracted_text.length > 800 ? 0.7 : 0.4;
  const independence = doc.tier <= 2 ? 0.8 : 0.4;
  return authority * 0.3 + relevance * 0.3 + recency * 0.15 + primaryEvidence * 0.15 + independence * 0.1;
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 80);
  }
}

export interface StoppingSnapshot {
  allQuestionsCovered: boolean;
  majorClaimsHaveEvidence: boolean;
  importantClaimsHaveMultipleSources: boolean;
  contradictionsResolved: boolean;
  sourceQualityAboveThreshold: boolean;
  criticPassed: boolean;
  complete: boolean;
}

export function evaluateStopping(args: {
  subquestions: ResearchSubquestion[];
  claims: ResearchClaim[];
  documents: ResearchDocument[];
  criticScore: number;
  criticThreshold: number;
  sourceQualityThreshold: number;
}): StoppingSnapshot {
  const allQuestionsCovered = args.subquestions.length === 0 || args.subquestions.every((q) => q.covered);
  const evidenced = args.claims.filter((c) => c.kind === "fact" || c.kind === "statistic" || c.kind === "definition");
  const majorClaimsHaveEvidence =
    evidenced.length === 0 || evidenced.every((c) => c.source_ids.length > 0 && c.confidence >= 0.4);
  const important = evidenced.filter((c) => c.confidence >= 0.6);
  const importantClaimsHaveMultipleSources =
    important.length === 0 ||
    important.filter((c) => c.source_ids.length >= 2).length >= Math.ceil(important.length * 0.5);
  const contradictionsResolved = args.claims.every(
    (c) => c.contradicting_evidence.length === 0 || c.confidence <= 0.7 || c.verified
  );
  const meanQuality =
    args.documents.length === 0
      ? 0
      : args.documents.reduce((sum, d) => sum + d.quality_score, 0) / args.documents.length;
  const sourceQualityAboveThreshold = meanQuality >= args.sourceQualityThreshold;
  const criticPassed = args.criticScore >= args.criticThreshold;
  return {
    allQuestionsCovered,
    majorClaimsHaveEvidence,
    importantClaimsHaveMultipleSources,
    contradictionsResolved,
    sourceQualityAboveThreshold,
    criticPassed,
    complete:
      allQuestionsCovered &&
      majorClaimsHaveEvidence &&
      importantClaimsHaveMultipleSources &&
      contradictionsResolved &&
      sourceQualityAboveThreshold &&
      criticPassed,
  };
}

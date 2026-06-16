/** Length preset drives `word_count` sent to the API (except "custom"). Empty = let AI infer length. */
export type BlogLengthPreset = "" | "short" | "medium" | "long" | "custom";

export interface BlogGenerationFormParams {
  lengthPreset: BlogLengthPreset;
  /** Used when `lengthPreset === "custom"` (clamped 300–8000 in helpers). */
  customWordCount: number;
  tone: string;
  target_audience: string;
  /** Comma-separated; parsed when building API hints. */
  topicsInput: string;
  purpose: string;
  structure: string;
}

export const defaultBlogGenerationFormParams = (): BlogGenerationFormParams => ({
  lengthPreset: "medium",
  customWordCount: 1500,
  tone: "",
  target_audience: "",
  topicsInput: "",
  purpose: "",
  structure: "",
});

export function getWordCountFromFormParams(p: BlogGenerationFormParams): number | undefined {
  if (p.lengthPreset === "custom") {
    const n = p.customWordCount;
    if (Number.isFinite(n) && n >= 300 && n <= 8000) {
      return Math.round(n);
    }
    return undefined;
  }
  if (p.lengthPreset === "short") {
    return 800;
  }
  if (p.lengthPreset === "medium") {
    return 1500;
  }
  if (p.lengthPreset === "long") {
    return 2500;
  }
  return undefined;
}

export function topicsInputToArray(topicsInput: string): string[] {
  return topicsInput
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}

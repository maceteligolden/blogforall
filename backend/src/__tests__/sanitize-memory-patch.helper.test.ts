import { describe, expect, it } from "@jest/globals";
import {
  parseDefaultWordCount,
  sanitizeMemoryPatch,
} from "../modules/orchestrator/utils/sanitize-memory-patch.helper";

describe("parseDefaultWordCount", () => {
  it("parses numeric values", () => {
    expect(parseDefaultWordCount(800)).toBe(800);
  });

  it("parses range strings like 800 to 1200", () => {
    expect(parseDefaultWordCount("800 to 1200")).toBe(1000);
  });

  it("parses word suffix strings", () => {
    expect(parseDefaultWordCount("800 words")).toBe(800);
  });

  it("returns undefined for non-numeric strings", () => {
    expect(parseDefaultWordCount("short")).toBeUndefined();
  });
});

describe("sanitizeMemoryPatch", () => {
  it("coerces nested preferences.default_word_count", () => {
    const result = sanitizeMemoryPatch({
      preferences: { default_word_count: "800 to 1200" },
    });
    expect(result.preferences).toEqual({ default_word_count: 1000 });
  });

  it("coerces dot-path preferences.default_word_count", () => {
    const result = sanitizeMemoryPatch({
      "preferences.default_word_count": "800 to 1200",
    });
    expect(result["preferences.default_word_count"]).toBe(1000);
  });
});

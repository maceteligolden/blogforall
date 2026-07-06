import { describe, expect, it } from "@jest/globals";
import { clampBlogExcerpt, BLOG_EXCERPT_MAX_LENGTH } from "../modules/blog/utils/excerpt.util";

describe("clampBlogExcerpt", () => {
  it("returns short excerpts unchanged", () => {
    const short = "A brief summary.";
    expect(clampBlogExcerpt(short)).toBe(short);
  });

  it("truncates excerpts longer than 500 characters", () => {
    const long = "Suya, a beloved street food. " + "word ".repeat(200);
    const result = clampBlogExcerpt(long);
    expect(result.length).toBeLessThanOrEqual(BLOG_EXCERPT_MAX_LENGTH);
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles exactly 800 char excerpt like the reported failure", () => {
    const excerpt = "Suya, a beloved street food fr" + "x".repeat(770);
    expect(excerpt.length).toBe(800);
    const result = clampBlogExcerpt(excerpt);
    expect(result.length).toBeLessThanOrEqual(500);
  });
});

import { describe, expect, it, beforeEach } from "@jest/globals";
import { sanitizeSearchQuery } from "../modules/blog/ai/search-query.util";
import { assertBlogAiRateLimit, __resetBlogAiRateLimitForTests } from "../shared/utils/blog-ai-rate-limit";
describe("sanitizeSearchQuery", () => {
  it("strips control characters and collapses whitespace", () => {
    const q = sanitizeSearchQuery("hello\x00world\n\t test", 100);
    expect(q).toBe("hello world test");
  });

  it("respects max length", () => {
    const long = "a".repeat(500);
    expect(sanitizeSearchQuery(long, 50).length).toBe(50);
  });
});

describe("assertBlogAiRateLimit", () => {
  beforeEach(() => {
    __resetBlogAiRateLimitForTests();
  });

  it("allows requests under the configured cap then rejects", () => {
    const userId = "user-rate-test";
    for (let i = 0; i < 20; i++) {
      assertBlogAiRateLimit(userId);
    }
    expect(() => assertBlogAiRateLimit(userId)).toThrow(/Too many AI requests/);
  });
});

import { describe, expect, it } from "@jest/globals";
import { sanitizeMetadata } from "../../shared/observability/sanitize";

describe("sanitizeMetadata", () => {
  it("redacts sensitive keys", () => {
    const result = sanitizeMetadata({
      apiKey: "sk-secret",
      authorization: "Bearer x",
      password: "pwd",
    });
    expect(result?.apiKey).toBe("[REDACTED]");
    expect(result?.authorization).toBe("[REDACTED]");
    expect(result?.password).toBe("[REDACTED]");
  });

  it("truncates long prompt content", () => {
    const longPrompt = "a".repeat(500);
    const result = sanitizeMetadata({ prompt: longPrompt });
    expect(String(result?.prompt)).toContain("truncated");
    expect(String(result?.prompt).length).toBeLessThan(300);
  });
});

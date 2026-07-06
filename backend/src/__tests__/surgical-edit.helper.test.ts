import { describe, expect, it } from "@jest/globals";
import {
  assessSurgicalUpdatePreservation,
  buildContextualSurgicalEditPrompt,
  isFullRewriteRequest,
} from "../modules/orchestrator/utils/surgical-edit.helper";

describe("assessSurgicalUpdatePreservation", () => {
  const original = `<h1>Title</h1><p>${"Intro paragraph with enough text. ".repeat(20)}</p><p>Highlight target sentence here for editing.</p><p>${"Closing paragraph with more context. ".repeat(20)}</p>`;

  it("rejects when proposed body is mostly deleted (excerpt-only update)", () => {
    const proposed = "<p>Highlight target sentence rewritten.</p>";
    const result = assessSurgicalUpdatePreservation(original, proposed, {
      excerpt: "Highlight target sentence here for editing.",
      userMessage: "make this clearer",
    });
    expect(result.ok).toBe(false);
    expect(result.concern).toBeDefined();
  });

  it("allows full rewrite requests", () => {
    const proposed = "<p>Brand new short post.</p>";
    const result = assessSurgicalUpdatePreservation(original, proposed, {
      excerpt: "Highlight target sentence here for editing.",
      userMessage: "rewrite the whole post from scratch",
    });
    expect(result.ok).toBe(true);
  });

  it("allows in-place edits that preserve surrounding content", () => {
    const proposed = original.replace(
      "Highlight target sentence here for editing.",
      "A clearer highlight target sentence after editing."
    );
    const result = assessSurgicalUpdatePreservation(original, proposed, {
      excerpt: "Highlight target sentence here for editing.",
      userMessage: "tighten this line",
    });
    expect(result.ok).toBe(true);
  });
});

describe("isFullRewriteRequest", () => {
  it("detects whole-post rewrite intents", () => {
    expect(isFullRewriteRequest("rewrite the entire post")).toBe(true);
    expect(isFullRewriteRequest("tighten this paragraph")).toBe(false);
  });
});

describe("buildContextualSurgicalEditPrompt", () => {
  it("requires full-body update and contextual zone rules", () => {
    const prompt = buildContextualSurgicalEditPrompt({
      blogId: "blog-1",
      originalHtml: "<p>Hello world</p>",
      userMessage: "make it punchier",
      excerpt: "Hello world",
    });
    expect(prompt).toContain("COMPLETE post");
    expect(prompt).toContain("Primary edit zone");
    expect(prompt).toContain("adjacent");
    expect(prompt).toContain("blogs.update");
  });
});

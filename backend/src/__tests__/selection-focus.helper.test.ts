import { describe, expect, it } from "@jest/globals";
import {
  buildHighlightContextBlock,
  ensureConversationContinuation,
  isDraftApplyRequest,
} from "../modules/orchestrator/utils/selection-focus.helper";

describe("buildHighlightContextBlock", () => {
  it("includes discussion and surgical rewrite rules", () => {
    const block = buildHighlightContextBlock({
      blog_id: "blog-1",
      reference_type: "highlight",
      text: "A sample paragraph.",
    });
    expect(block).toContain("FOCUSED SELECTION");
    expect(block).toContain("DISCUSSION (default)");
    expect(block).toContain("CONTEXTUAL SURGICAL");
    expect(block).toContain("A sample paragraph.");
  });
});

describe("isDraftApplyRequest", () => {
  it("detects rewrite and update intents", () => {
    expect(isDraftApplyRequest("rewrite this paragraph")).toBe(true);
    expect(isDraftApplyRequest("please update the draft")).toBe(true);
    expect(isDraftApplyRequest("what do you think of this?")).toBe(false);
  });
});

describe("ensureConversationContinuation", () => {
  it("repairs dead-end acknowledgments with selection follow-up", () => {
    const result = ensureConversationContinuation("Got it.", {
      hasSelectionFocus: true,
      selectionSnippet: "intro sentence",
    });
    expect(result.repaired).toBe(true);
    expect(result.reply).toContain("Got it —");
    expect(result.reply).toContain("?");
  });

  it("leaves substantive replies with questions unchanged", () => {
    const reply = "This passage sets up the problem well. Want me to tighten the opening line?";
    const result = ensureConversationContinuation(reply, { hasSelectionFocus: true });
    expect(result.repaired).toBe(false);
    expect(result.reply).toBe(reply);
  });
});

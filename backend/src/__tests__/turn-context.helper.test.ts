import { describe, expect, it } from "@jest/globals";
import { buildEnrichedUserMessage } from "../modules/orchestrator/utils/turn-context.helper";
import { orchestratorChatBodySchema } from "../modules/orchestrator/validations/orchestrator-route.validation";

describe("buildEnrichedUserMessage", () => {
  it("injects highlight selection context", () => {
    const result = buildEnrichedUserMessage({
      message: "Make this clearer",
      selectionContext: {
        blog_id: "blog-123",
        reference_type: "highlight",
        text: "Selected paragraph text",
      },
    });
    expect(result).toContain("[FOCUSED SELECTION — blog blog-123]");
    expect(result).toContain("Selected paragraph text");
    expect(result).toContain("Make this clearer");
  });

  it("injects blog-only reference context", () => {
    const result = buildEnrichedUserMessage({
      message: "Improve the intro",
      selectionContext: {
        blog_id: "blog-456",
        reference_type: "blog",
      },
    });
    expect(result).toContain("[User is referencing blog post blog-456");
    expect(result).toContain("blogs.get and blogs.update");
    expect(result).not.toContain("highlighted section");
  });

  it("omits selection block when highlight has no text", () => {
    const result = buildEnrichedUserMessage({
      message: "Hello",
      selectionContext: {
        blog_id: "blog-789",
        reference_type: "highlight",
      },
    });
    expect(result).toBe("Hello");
  });
});

describe("orchestratorChatBodySchema selection_context", () => {
  it("accepts blog reference without text", () => {
    const parsed = orchestratorChatBodySchema.parse({
      message: "Edit this draft",
      selection_context: {
        blog_id: "blog-1",
        reference_type: "blog",
      },
    });
    expect(parsed.selection_context?.reference_type).toBe("blog");
    expect(parsed.selection_context?.text).toBeUndefined();
  });

  it("accepts highlight reference with text", () => {
    const parsed = orchestratorChatBodySchema.parse({
      message: "Tighten this",
      selection_context: {
        blog_id: "blog-2",
        reference_type: "highlight",
        text: "Some selected text",
      },
    });
    expect(parsed.selection_context?.text).toBe("Some selected text");
  });

  it("rejects highlight reference without text", () => {
    expect(() =>
      orchestratorChatBodySchema.parse({
        message: "Tighten this",
        selection_context: {
          blog_id: "blog-3",
          reference_type: "highlight",
        },
      })
    ).toThrow();
  });
});

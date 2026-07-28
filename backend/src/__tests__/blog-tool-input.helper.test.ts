import { describe, expect, it } from "@jest/globals";
import { normalizeBlogToolInput } from "../modules/orchestrator/ai/tools/_helpers";

describe("normalizeBlogToolInput", () => {
  it("maps blog_id to id", () => {
    const out = normalizeBlogToolInput({ blog_id: "abc", content: "hello" });
    expect(out).toEqual({ id: "abc", content: "hello" });
  });

  it("keeps explicit id when both are present", () => {
    const out = normalizeBlogToolInput({ id: "keep", blog_id: "drop" });
    expect(out.id).toBe("keep");
    expect(out.blog_id).toBe("drop");
  });

  it("maps postId alias to id", () => {
    const out = normalizeBlogToolInput({ postId: "xyz" });
    expect(out).toEqual({ id: "xyz" });
  });

  it("maps query and topic to title", () => {
    expect(normalizeBlogToolInput({ query: "jokers" })).toEqual({ title: "jokers" });
    expect(normalizeBlogToolInput({ topic: "remote work" })).toEqual({ title: "remote work" });
  });
});

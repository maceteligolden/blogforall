import { describe, expect, it } from "@jest/globals";
import { ensureHtmlContent, markdownToBlocks, blocksToHtml } from "../shared/utils/content-blocks.util";

describe("ensureHtmlContent", () => {
  it("converts markdown headings and lists to HTML", () => {
    const md = `# Title\n\nIntro paragraph.\n\n## Section\n\n- one\n- two\n`;
    const html = ensureHtmlContent(md);
    expect(html).toContain("<h1>");
    expect(html).toContain("<h2>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>");
    expect(html).not.toMatch(/^#/m);
  });

  it("leaves existing HTML alone", () => {
    const html = "<h2>Hello</h2>\n<p>World</p>";
    expect(ensureHtmlContent(html)).toBe(html);
  });

  it("strips html code fences then keeps HTML", () => {
    const fenced = "```html\n<h2>Hi</h2>\n<p>There</p>\n```";
    const out = ensureHtmlContent(fenced);
    expect(out).toContain("<h2>Hi</h2>");
    expect(out).not.toContain("```");
  });

  it("markdownToBlocks + blocksToHtml round-trips lists", () => {
    const blocks = markdownToBlocks("- a\n- b");
    expect(blocks[0]?.type).toBe("list");
    expect(blocksToHtml(blocks)).toContain("<ul>");
  });
});

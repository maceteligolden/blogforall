import type { ContentBlock } from "@/lib/types/blog";
import { htmlToBlocks } from "./html-to-blocks";

function genId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function strip(md: string): string {
  return String(md)
    .replace(/\r/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Minimal Markdown → content_blocks converter for the editor.
 * Supports the parts we commonly receive from the review runner:
 * - headings (#, ##, ###)
 * - unordered lists (- / *)
 * - ordered lists (1.)
 * - blockquotes (>)
 * - fenced code blocks (```lang ... ```)
 * Everything else becomes paragraph blocks.
 */
export function markdownToBlocks(markdown: string): ContentBlock[] {
  const src = markdown?.trim();
  if (!src) return [{ id: genId(), type: "paragraph", data: { text: "" } }];

  const blocks: ContentBlock[] = [];
  const lines = src.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Skip empty lines
    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block
    const codeFence = line.match(/^```(\w+)?\s*$/);
    if (codeFence) {
      const lang = codeFence[1] ?? "";
      i++;
      const codeLines: string[] = [];
      while (i < lines.length && !(lines[i] ?? "").match(/^```/)) {
        codeLines.push(lines[i] ?? "");
        i++;
      }
      // Consume closing fence if present
      if (i < lines.length && (lines[i] ?? "").match(/^```/)) i++;
      blocks.push({
        id: genId(),
        type: "code",
        data: { text: codeLines.join("\n"), language: lang || undefined },
      });
      continue;
    }

    // Headings: # / ## / ###
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      const level = heading[1].length;
      blocks.push({
        id: genId(),
        type: "heading",
        data: { level, text: strip(heading[2]) },
      });
      i++;
      continue;
    }

    // Blockquote: consecutive > lines
    if (line.match(/^>\s?.+/)) {
      const quoteLines: string[] = [];
      while (i < lines.length && (lines[i] ?? "").match(/^>\s?.+/)) {
        quoteLines.push(strip((lines[i] ?? "").replace(/^>\s?/, "")));
        i++;
      }
      blocks.push({ id: genId(), type: "blockquote", data: { text: quoteLines.join("\n") } });
      continue;
    }

    // Unordered list: - / *
    const ul = line.match(/^[-*]\s+(.+)$/);
    if (ul) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(/^[-*]\s+(.+)$/);
        if (!m) break;
        items.push(strip(m[1]));
        i++;
      }
      blocks.push({ id: genId(), type: "list", data: { listType: "bullet", items } });
      continue;
    }

    // Ordered list: 1.
    const ol = line.match(/^\d+\.\s+(.+)$/);
    if (ol) {
      const items: string[] = [];
      while (i < lines.length) {
        const m = (lines[i] ?? "").match(/^\d+\.\s+(.+)$/);
        if (!m) break;
        items.push(strip(m[1]));
        i++;
      }
      blocks.push({ id: genId(), type: "list", data: { listType: "ordered", items } });
      continue;
    }

    // Paragraph: accumulate until blank line
    const paraLines: string[] = [];
    while (i < lines.length && (lines[i] ?? "").trim()) {
      // Stop paragraphs at the start of other block types
      if ((lines[i] ?? "").match(/^```(\w+)?\s*$/)) break;
      if ((lines[i] ?? "").match(/^(#{1,3})\s+.+$/)) break;
      if ((lines[i] ?? "").match(/^>\s?.+$/)) break;
      if ((lines[i] ?? "").match(/^[-*]\s+.+$/)) break;
      if ((lines[i] ?? "").match(/^\d+\.\s+.+$/)) break;

      paraLines.push((lines[i] ?? "").trim());
      i++;
    }

    blocks.push({ id: genId(), type: "paragraph", data: { text: strip(paraLines.join(" ")) } });
  }

  if (blocks.length === 0) return [{ id: genId(), type: "paragraph", data: { text: "" } }];
  return blocks;
}

function looksLikeHtml(content: string): boolean {
  return /<\/?(p|h[1-3]|ul|ol|li|blockquote|pre|code|figure|img|h4|h5|h6)\b/i.test(content);
}

function looksLikeMarkdown(content: string): boolean {
  return /(^|\n)#{1,3}\s+/m.test(content) || /(^|\n)[-*]\s+.+/m.test(content) || /(^|\n)\d+\.\s+.+/m.test(content) || /(^|\n)>\s+.+/m.test(content) || /```/m.test(content);
}

/**
 * Converts editor input content (HTML or Markdown-ish) into `content_blocks`.
 */
export function contentToBlocks(content: string): ContentBlock[] {
  const c = content ?? "";
  if (looksLikeHtml(c)) return htmlToBlocks(c);
  if (looksLikeMarkdown(c)) return markdownToBlocks(c);
  // Fallback: try HTML parser; if it's markdown without tags, it will degrade to paragraphs.
  return htmlToBlocks(c);
}


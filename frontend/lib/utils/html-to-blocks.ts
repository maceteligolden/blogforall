import type { ContentBlock } from "@/lib/types/blog";

function genId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function strip(html: string): string {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Client-side HTML → content_blocks for legacy posts (no content_blocks).
 * Handles p, h1-h3, ul/ol, figure.ql-image-with-caption, blockquote, pre/code.
 */
export function htmlToBlocks(html: string): ContentBlock[] {
  if (!html?.trim()) return [{ id: genId(), type: "paragraph", data: { text: "" } }];
  const str = html.trim();
  const blocks: ContentBlock[] = [];
  const figureRe =
    /<figure[^>]*class="[^"]*ql-image-with-caption[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/gi;
  const regexes: { re: RegExp; parse: (m: RegExpExecArray) => ContentBlock }[] = [
    {
      re: figureRe,
      parse: (m) => ({ id: genId(), type: "image", data: { url: m[1] ?? "", caption: strip(m[2] ?? "") } }),
    },
    { re: /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i, parse: (m) => ({ id: genId(), type: "heading", data: { level: parseInt(m[1], 10), text: strip(m[2]) } }) },
    { re: /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i, parse: (m) => ({ id: genId(), type: "blockquote", data: { text: strip(m[1]) } }) },
    {
      re: /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/i,
      parse: (m) => ({ id: genId(), type: "code", data: { text: (m[1] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") } }),
    },
    {
      re: /<ul[^>]*>([\s\S]*?)<\/ul>/i,
      parse: (m) => {
        const items: string[] = [];
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let lm: RegExpExecArray | null;
        while ((lm = liRe.exec(m[1] ?? "")) !== null) items.push(strip(lm[1]));
        return { id: genId(), type: "list", data: { listType: "bullet", items } };
      },
    },
    {
      re: /<ol[^>]*>([\s\S]*?)<\/ol>/i,
      parse: (m) => {
        const items: string[] = [];
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let lm: RegExpExecArray | null;
        while ((lm = liRe.exec(m[1] ?? "")) !== null) items.push(strip(lm[1]));
        return { id: genId(), type: "list", data: { listType: "ordered", items } };
      },
    },
    { re: /<p[^>]*>([\s\S]*?)<\/p>/i, parse: (m) => ({ id: genId(), type: "paragraph", data: { text: strip(m[1] ?? "") } }) },
  ];

  let remaining = str;
  while (remaining.length > 0) {
    let best: { index: number; length: number; block: ContentBlock } | null = null;
    for (const { re, parse } of regexes) {
      re.lastIndex = 0;
      const m = re.exec(remaining);
      if (m && m.index !== undefined && m[0] && (best === null || m.index < best.index)) {
        best = { index: m.index, length: m[0].length, block: parse(m) };
      }
    }
    if (best) {
      if (best.index > 0) {
        const t = strip(remaining.slice(0, best.index));
        if (t) blocks.push({ id: genId(), type: "paragraph", data: { text: t } });
      }
      blocks.push(best.block);
      remaining = remaining.slice(best.index + best.length).replace(/^\s*/, "");
    } else {
      const t = strip(remaining);
      if (t) blocks.push({ id: genId(), type: "paragraph", data: { text: t } });
      break;
    }
  }
  if (blocks.length === 0) blocks.push({ id: genId(), type: "paragraph", data: { text: "" } });
  return blocks;
}

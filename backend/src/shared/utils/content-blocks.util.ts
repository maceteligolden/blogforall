import { ContentBlock, ContentBlockType } from "../schemas/blog.schema";
import { BadRequestError } from "../errors";

const BLOB_URL_PREFIX = "blob:";

function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

/**
 * Validates content_blocks for save/publish:
 * - No blob URLs (all images must be uploaded)
 * - Every image block must have a non-empty caption
 */
export function validateContentBlocks(blocks: ContentBlock[]): void {
  if (!blocks || !Array.isArray(blocks)) return;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    if (block.type === "image") {
      const url = block.data?.url;
      if (!url || typeof url !== "string") {
        throw new BadRequestError(`Image block at position ${i + 1} has no image.`);
      }
      if (url.startsWith(BLOB_URL_PREFIX)) {
        throw new BadRequestError(
          "One or more images are still uploading. Please wait for uploads to complete before saving."
        );
      }
      const caption = block.data?.caption;
      if (caption === undefined || caption === null || String(caption).trim() === "") {
        throw new BadRequestError(`Image at position ${i + 1} requires a caption.`);
      }
    }
  }
}

/**
 * Escapes HTML to prevent XSS when rendering user text.
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return String(text).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/**
 * Generates HTML from content_blocks for backward compatibility and simple consumers.
 */
export function blocksToHtml(blocks: ContentBlock[]): string {
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) {
    return "<p></p>";
  }

  const parts: string[] = [];

  for (const block of blocks) {
    const type = block.type as ContentBlockType;
    const data = block.data ?? {};

    switch (type) {
      case "paragraph": {
        const text = data.text ?? "";
        parts.push(`<p>${escapeHtml(text)}</p>`);
        break;
      }
      case "heading": {
        const level = Math.min(3, Math.max(1, data.level ?? 1));
        const text = data.text ?? "";
        parts.push(`<h${level}>${escapeHtml(text)}</h${level}>`);
        break;
      }
      case "list": {
        const items = Array.isArray(data.items) ? data.items : [];
        const tag = data.listType === "ordered" ? "ol" : "ul";
        const lis = items.map((item) => `<li>${escapeHtml(String(item))}</li>`).join("");
        parts.push(`<${tag}>${lis}</${tag}>`);
        break;
      }
      case "image": {
        const url = data.url ?? "";
        const caption = data.caption ?? "";
        if (url) {
          parts.push(
            `<figure class="ql-image-with-caption"><img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" /><figcaption class="image-caption">${escapeHtml(caption)}</figcaption></figure>`
          );
        }
        break;
      }
      case "blockquote": {
        const text = data.text ?? "";
        parts.push(`<blockquote>${escapeHtml(text)}</blockquote>`);
        break;
      }
      case "code": {
        const text = data.text ?? "";
        const lang = data.language ? ` class="language-${escapeHtml(String(data.language))}"` : "";
        parts.push(`<pre><code${lang}>${escapeHtml(text)}</code></pre>`);
        break;
      }
      default:
        // Unknown type: treat as paragraph if it has text
        const fallbackText = (data as { text?: string }).text ?? "";
        parts.push(`<p>${escapeHtml(fallbackText)}</p>`);
    }
  }

  return parts.join("\n");
}

/**
 * Strips HTML tags and decodes common entities (for text content from HTML).
 */
function stripHtml(html: string): string {
  return String(html)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .trim();
}

/**
 * Converts legacy HTML content to content_blocks (for first-edit migration).
 * Handles p, h1-h3, ul/ol+li, figure (img+figcaption), blockquote, pre+code.
 * Parses in document order by repeatedly matching the next block-level element.
 */
export function htmlToBlocks(html: string): ContentBlock[] {
  if (!html || typeof html !== "string" || html.trim() === "") {
    return [{ id: generateBlockId(), type: "paragraph", data: { text: "" } }];
  }

  const blocks: ContentBlock[] = [];
  let str = html.trim();

  const figureRegex =
    /<figure[^>]*class="[^"]*ql-image-with-caption[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/i;
  const blockRegexes: { regex: RegExp; type: ContentBlockType; parse: (m: RegExpExecArray) => ContentBlock }[] = [
    {
      regex: /<figure[^>]*class="[^"]*ql-image-with-caption[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]*)"[^>]*>[\s\S]*?(?:<figcaption[^>]*>([\s\S]*?)<\/figcaption>)?[\s\S]*?<\/figure>/i,
      type: "image",
      parse: (m) => ({ id: generateBlockId(), type: "image", data: { url: m[1] ?? "", caption: stripHtml(m[2] ?? "") } }),
    },
    {
      regex: /<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/i,
      type: "heading",
      parse: (m) => ({ id: generateBlockId(), type: "heading", data: { level: parseInt(m[1], 10), text: stripHtml(m[2]) } }),
    },
    {
      regex: /<blockquote[^>]*>([\s\S]*?)<\/blockquote>/i,
      type: "blockquote",
      parse: (m) => ({ id: generateBlockId(), type: "blockquote", data: { text: stripHtml(m[1]) } }),
    },
    {
      regex: /<pre[^>]*>\s*<code[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/i,
      type: "code",
      parse: (m) => ({
        id: generateBlockId(),
        type: "code",
        data: { text: (m[1] ?? "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&") },
      }),
    },
    {
      regex: /<ul[^>]*>([\s\S]*?)<\/ul>/i,
      type: "list",
      parse: (m) => {
        const items: string[] = [];
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch: RegExpExecArray | null;
        while ((liMatch = liRegex.exec(m[1] ?? "")) !== null) items.push(stripHtml(liMatch[1]));
        return { id: generateBlockId(), type: "list", data: { listType: "bullet", items } };
      },
    },
    {
      regex: /<ol[^>]*>([\s\S]*?)<\/ol>/i,
      type: "list",
      parse: (m) => {
        const items: string[] = [];
        const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
        let liMatch: RegExpExecArray | null;
        while ((liMatch = liRegex.exec(m[1] ?? "")) !== null) items.push(stripHtml(liMatch[1]));
        return { id: generateBlockId(), type: "list", data: { listType: "ordered", items } };
      },
    },
    {
      regex: /<p[^>]*>([\s\S]*?)<\/p>/i,
      type: "paragraph",
      parse: (m) => ({ id: generateBlockId(), type: "paragraph", data: { text: stripHtml(m[1] ?? "") } }),
    },
  ];

  while (str.length > 0) {
    let bestMatch: { index: number; length: number; block: ContentBlock } | null = null;

    for (const { regex, parse } of blockRegexes) {
      regex.lastIndex = 0;
      const m = regex.exec(str);
      if (m && m.index !== undefined && m[0] && (bestMatch === null || m.index < bestMatch.index)) {
        bestMatch = { index: m.index, length: m[0].length, block: parse(m) };
      }
    }

    if (bestMatch) {
      if (bestMatch.index > 0) {
        const text = stripHtml(str.slice(0, bestMatch.index));
        if (text.length > 0) {
          blocks.push({ id: generateBlockId(), type: "paragraph", data: { text } });
        }
      }
      blocks.push(bestMatch.block);
      str = str.slice(bestMatch.index + bestMatch.length).replace(/^\s*/, "");
    } else {
      const text = stripHtml(str);
      if (text.length > 0) blocks.push({ id: generateBlockId(), type: "paragraph", data: { text } });
      break;
    }
  }

  if (blocks.length === 0) {
    blocks.push({ id: generateBlockId(), type: "paragraph", data: { text: "" } });
  }
  return blocks;
}

import { ContentBlock, ContentBlockType } from "../schemas/blog.schema";
import { BadRequestError } from "../errors";

const BLOB_URL_PREFIX = "blob:";

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

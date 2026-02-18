import type { ContentBlock } from "@/lib/types/blog";

/** Returns true if any image block has a blob URL or is missing caption */
export function getContentBlocksValidationErrors(blocks: ContentBlock[]): {
  hasBlobUrls: boolean;
  missingCaptions: boolean;
} {
  let hasBlobUrls = false;
  let missingCaptions = false;
  for (const block of blocks) {
    if (block.type === "image") {
      const url = block.data?.url ?? "";
      if (url.startsWith("blob:")) hasBlobUrls = true;
      const caption = block.data?.caption ?? "";
      if (!caption || String(caption).trim() === "") missingCaptions = true;
    }
  }
  return { hasBlobUrls, missingCaptions };
}

export function canSaveContentBlocks(blocks: ContentBlock[]): boolean {
  const { hasBlobUrls, missingCaptions } = getContentBlocksValidationErrors(blocks);
  return !hasBlobUrls && !missingCaptions;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
  return String(text).replace(/[&<>"']/g, (c) => map[c] ?? c);
}

/** Build HTML from blocks (e.g. for review API or display) */
export function blocksToHtml(blocks: ContentBlock[]): string {
  if (!blocks?.length) return "<p></p>";
  const parts: string[] = [];
  for (const block of blocks) {
    const d = block.data ?? {};
    switch (block.type) {
      case "paragraph":
        parts.push(`<p>${escapeHtml(d.text ?? "")}</p>`);
        break;
      case "heading":
        parts.push(`<h${Math.min(3, Math.max(1, d.level ?? 1))}>${escapeHtml(d.text ?? "")}</h${Math.min(3, Math.max(1, d.level ?? 1))}>`);
        break;
      case "list": {
        const tag = d.listType === "ordered" ? "ol" : "ul";
        const items = Array.isArray(d.items) ? d.items : [];
        parts.push(`<${tag}>${items.map((i) => `<li>${escapeHtml(String(i))}</li>`).join("")}</${tag}>`);
        break;
      }
      case "image":
        if (d.url) parts.push(`<figure><img src="${escapeHtml(d.url)}" alt="${escapeHtml(d.caption ?? "")}" /><figcaption>${escapeHtml(d.caption ?? "")}</figcaption></figure>`);
        break;
      case "blockquote":
        parts.push(`<blockquote>${escapeHtml(d.text ?? "")}</blockquote>`);
        break;
      case "code":
        parts.push(`<pre><code>${escapeHtml(d.text ?? "")}</code></pre>`);
        break;
      default:
        parts.push(`<p>${escapeHtml((d as { text?: string }).text ?? "")}</p>`);
    }
  }
  return parts.join("\n");
}

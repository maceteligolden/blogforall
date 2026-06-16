import type { ContentBlock } from "@/lib/types/blog";
import { blocksToHtml } from "@/lib/utils/content-blocks";

function stripHtmlToPlainText(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function hasTitle(title: string): boolean {
  return title.trim().length > 0;
}

export function hasBodyContent(input: { content: string; content_blocks?: ContentBlock[] }): boolean {
  if (input.content_blocks != null && input.content_blocks.length > 0) {
    const html = blocksToHtml(input.content_blocks);
    return stripHtmlToPlainText(html).length > 0;
  }
  return Boolean(input.content?.trim());
}

export type BlogFormCompareFields = {
  title: string;
  content: string;
  content_blocks?: ContentBlock[];
  featured_image: string;
  category: string;
  status: string;
  scheduled_at: string;
};

function normalizeBlockForCompare(block: ContentBlock): { type: string; data: unknown } {
  return {
    type: block.type,
    data: JSON.parse(JSON.stringify(block.data ?? {})),
  };
}

/** Stable snapshot for dirty-checking the blog editor form (ids on blocks are ignored). */
export function normalizeFormForCompare(fd: BlogFormCompareFields): Record<string, unknown> {
  const useBlocks = fd.content_blocks != null && fd.content_blocks.length > 0;
  return {
    title: fd.title.trim(),
    body: useBlocks
      ? {
          kind: "blocks",
          blocks: fd.content_blocks!.map(normalizeBlockForCompare),
        }
      : { kind: "html", content: (fd.content || "").trim() },
    featured_image: fd.featured_image || "",
    category: fd.category || "",
    status: fd.status,
    scheduled_at: fd.scheduled_at || "",
  };
}

export function formFingerprint(fd: BlogFormCompareFields): string {
  return JSON.stringify(normalizeFormForCompare(fd));
}

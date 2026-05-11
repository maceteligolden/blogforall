import { injectable } from "tsyringe";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { logger } from "../../../shared/utils/logger";
import type { ResearchNote } from "./types";
import { sanitizeSearchQuery } from "./search-query.util";

export { sanitizeSearchQuery } from "./search-query.util";

function isAbortLikeError(e: unknown): boolean {
  if (e == null || typeof e !== "object") return false;
  const err = e as { name?: string; message?: string };
  if (err.name === "AbortError") return true;
  if (typeof DOMException !== "undefined" && e instanceof DOMException && e.name === "AbortError") return true;
  const msg = typeof err.message === "string" ? err.message : "";
  return msg.includes("aborted") || msg.includes("AbortError");
}

@injectable()
export class TavilySearchService {
  /**
   * Run Tavily search. Returns empty results if disabled or unconfigured.
   */
  async search(query: string, signal?: AbortSignal): Promise<ResearchNote[]> {
    if (!BlogAiConfig.tavilyApiKey || !BlogAiConfig.enableWebSearch) {
      return [];
    }

    const q = sanitizeSearchQuery(query, BlogAiConfig.searchMaxQueryLength);
    if (!q) {
      return [];
    }

    if (signal?.aborted) {
      return [];
    }

    try {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: BlogAiConfig.tavilyApiKey,
          query: q,
          max_results: BlogAiConfig.maxSearchResults,
          search_depth: "basic",
          include_answer: false,
        }),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.warn("Tavily search failed", { status: res.status, body: text.slice(0, 200) }, "TavilySearchService");
        return [];
      }

      const data = (await res.json()) as {
        results?: Array<{ url?: string; title?: string; content?: string }>;
      };
      const results = data.results ?? [];
      return results
        .filter((r) => r.url && (r.content || r.title))
        .map((r) => ({
          url: String(r.url),
          title: String(r.title ?? "").slice(0, 300),
          snippet: String(r.content ?? r.title ?? "").slice(0, 1200),
        }));
    } catch (e) {
      const isAbort = isAbortLikeError(e);
      const err = e as Error;
      if (isAbort) {
        logger.debug("Tavily search cancelled (aborted)", {}, "TavilySearchService");
      } else {
        logger.warn("Tavily search error", { error: err?.message ?? String(e) }, "TavilySearchService");
      }
      return [];
    }
  }

  buildQuery(prompt: string, topic: string, topics: string[] | undefined): string {
    const parts = [topic, ...(topics ?? []).slice(0, 8)].filter(Boolean);
    const base = parts.join(" ").trim() || prompt.slice(0, 200);
    return sanitizeSearchQuery(`${base} ${prompt.slice(0, 150)}`.trim(), BlogAiConfig.searchMaxQueryLength);
  }
}

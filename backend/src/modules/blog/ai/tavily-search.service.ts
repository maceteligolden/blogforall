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

  /**
   * Extract page content for one or more URLs via Tavily Extract.
   * Returns [] when disabled, unconfigured, or the API fails.
   */
  async extract(
    urls: string[],
    signal?: AbortSignal
  ): Promise<Array<{ url: string; title?: string; text: string }>> {
    if (!BlogAiConfig.tavilyApiKey || !BlogAiConfig.enableWebSearch) {
      return [];
    }
    const cleaned = urls.map((u) => u.trim()).filter(Boolean).slice(0, 5);
    if (cleaned.length === 0) return [];
    if (signal?.aborted) return [];

    try {
      const res = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: BlogAiConfig.tavilyApiKey,
          urls: cleaned,
          extract_depth: "basic",
        }),
        signal,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        logger.warn(
          "Tavily extract failed",
          { status: res.status, body: text.slice(0, 200) },
          "TavilySearchService"
        );
        return [];
      }

      const data = (await res.json()) as {
        results?: Array<{ url?: string; title?: string; raw_content?: string; content?: string }>;
        failed_results?: Array<{ url?: string; error?: string }>;
      };

      const results = data.results ?? [];
      const extracted: Array<{ url: string; title?: string; text: string }> = [];
      for (const r of results) {
        const text = String(r.raw_content ?? r.content ?? "").trim();
        if (!r.url || !text) continue;
        extracted.push({
          url: String(r.url),
          title: r.title ? String(r.title).slice(0, 300) : undefined,
          text: text.slice(0, 50_000),
        });
      }
      return extracted;
    } catch (e) {
      const isAbort = isAbortLikeError(e);
      const err = e as Error;
      if (isAbort) {
        logger.debug("Tavily extract cancelled (aborted)", {}, "TavilySearchService");
      } else {
        logger.warn("Tavily extract error", { error: err?.message ?? String(e) }, "TavilySearchService");
      }
      return [];
    }
  }

  buildQuery(prompt: string, topic: string, topics: string[] | undefined): string {
    const parts = [topic, ...(topics ?? []).slice(0, 8)].filter(Boolean);
    const base = parts.join(" ").trim() || prompt.slice(0, 200);
    return sanitizeSearchQuery(`${base} ${prompt.slice(0, 150)}`.trim(), BlogAiConfig.searchMaxQueryLength);
  }

  /**
   * Multi-query research: run several related searches and merge unique URLs.
   * Targets 5–15 sources when available; returns [] when search is disabled.
   */
  async searchMultiQuery(
    topic: string,
    options?: { minSources?: number; maxSources?: number; signal?: AbortSignal }
  ): Promise<ResearchNote[]> {
    const minSources = options?.minSources ?? 5;
    const maxSources = options?.maxSources ?? 15;
    if (!BlogAiConfig.tavilyApiKey || !BlogAiConfig.enableWebSearch) {
      return [];
    }

    const queries = [
      topic,
      `${topic} best practices`,
      `${topic} statistics trends`,
      `${topic} how to guide`,
      `${topic} common mistakes`,
    ]
      .map((q) => sanitizeSearchQuery(q, BlogAiConfig.searchMaxQueryLength))
      .filter(Boolean);

    const byUrl = new Map<string, ResearchNote>();
    for (const q of queries) {
      if (options?.signal?.aborted) break;
      const notes = await this.search(q, options?.signal);
      for (const n of notes) {
        if (!byUrl.has(n.url)) byUrl.set(n.url, n);
      }
      if (byUrl.size >= maxSources) break;
    }

    if (byUrl.size < minSources && !options?.signal?.aborted) {
      const extra = await this.search(`${topic} overview guide`, options?.signal);
      for (const n of extra) {
        if (!byUrl.has(n.url)) byUrl.set(n.url, n);
      }
    }

    return [...byUrl.values()].slice(0, maxSources);
  }
}

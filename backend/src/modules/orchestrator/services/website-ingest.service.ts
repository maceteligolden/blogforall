import { injectable } from "tsyringe";
import { z } from "zod";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { env } from "../../../shared/config/env";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { logger } from "../../../shared/utils/logger";
import { TavilySearchService } from "../../blog/ai/tavily-search.service";
import type { WorkspaceOnboardingProposal } from "../../../shared/schemas/workspace-memory.schema";
import { normalizeWebsiteUrl, formatProposalSummary } from "../utils/website-onboarding.helper";
import { parseDefaultWordCount } from "../utils/sanitize-memory-patch.helper";
import { BUSINESS_MODELS, normalizeCompetitors, normalizeCustomers } from "../../../shared/types/business-profile";

const MAX_TEXT_CHARS = 24_000;
const FETCH_TIMEOUT_MS = 12_000;
const FETCH_MAX_BYTES = 1_500_000;

export interface WebsiteIngestResult {
  url: string;
  title?: string;
  text: string;
  source: "tavily" | "fetch";
}

const proposalSchema = z.object({
  industries: z.array(z.string().max(100)).max(10).optional().nullable(),
  business_model: z.enum(BUSINESS_MODELS).optional().nullable(),
  business_description: z.string().max(8000).optional().nullable(),
  business_type: z.string().max(200).optional().nullable(),
  target_audience: z.array(z.string().max(200)).max(10).optional().nullable(),
  customers: z
    .array(
      z.object({
        who: z.string().max(4000),
        pain_points: z.string().max(4000).optional().nullable(),
        success: z.string().max(4000).optional().nullable(),
        label: z.string().max(200).optional().nullable(),
      })
    )
    .max(10)
    .optional()
    .nullable(),
  brand_voice: z.string().max(4000).optional().nullable(),
  brand_negatives: z.string().max(4000).optional().nullable(),
  business_goals: z.array(z.string().max(300)).max(10).optional().nullable(),
  seo_priorities: z.array(z.string().max(200)).max(20).optional().nullable(),
  publishing_channels: z.array(z.string().max(100)).max(15).optional().nullable(),
  competitors: z
    .array(
      z.object({
        name: z.string().max(200),
        notes: z.string().max(2000).optional().nullable(),
      })
    )
    .max(15)
    .optional()
    .nullable(),
  competitive_notes: z.string().max(2000).optional().nullable(),
  tone: z.string().max(200).optional().nullable(),
  default_word_count: z.number().min(300).max(8000).optional().nullable(),
  memory_summary: z.string().max(2000).optional().nullable(),
});

@injectable()
export class WebsiteIngestService {
  constructor(private readonly tavily: TavilySearchService) {}

  async ingest(rawUrl: string, signal?: AbortSignal): Promise<WebsiteIngestResult | null> {
    const url = normalizeWebsiteUrl(rawUrl);
    if (!url) return null;

    const fromTavily = await this.tavily.extract([url], signal);
    const tavilyHit = fromTavily.find((r) => r.text.trim().length > 80) ?? fromTavily[0];
    if (tavilyHit?.text?.trim()) {
      return {
        url,
        title: tavilyHit.title,
        text: tavilyHit.text.slice(0, MAX_TEXT_CHARS),
        source: "tavily",
      };
    }

    const fetched = await this.fetchPageText(url, signal);
    if (fetched?.text?.trim()) {
      return {
        url,
        title: fetched.title,
        text: fetched.text.slice(0, MAX_TEXT_CHARS),
        source: "fetch",
      };
    }

    logger.warn("Website ingest produced no content", { url }, "WebsiteIngestService");
    return null;
  }

  async mapToProposal(ingest: WebsiteIngestResult): Promise<WorkspaceOnboardingProposal> {
    const apiKey = env.orchestrator.openaiApiKey || BlogAiConfig.openaiApiKey;
    if (!apiKey) {
      return this.heuristicProposal(ingest);
    }

    try {
      const chat = createChatOpenAI({
        apiKey,
        model: env.orchestrator.supervisorModel || BlogAiConfig.chatModel || "gpt-4o-mini",
        temperature: 0.2,
        timeout: 45_000,
      });
      const structured = chat.withStructuredOutput(proposalSchema);
      const raw = await structured.invoke([
        {
          role: "system",
          content: `You extract workspace brand/onboarding fields from a business or personal website.
Return only fields you can reasonably infer.
- business_description: 1-3 paragraphs describing what the business does (not a bullet list).
- business_model: one of b2b, b2c, c2c, b2b2c when clear.
- industries: short industry labels.
- customers: array of personas with who, pain_points, success (paragraphs), optional label.
- target_audience: short labels only.
- brand_voice: descriptive prose of how the brand sounds.
- brand_negatives: words/tones/claims to avoid.
- competitors: array of {name, notes?}.
- Prefer arrays for goals, SEO topics, and channels.
default_word_count: single integer 300–8000 when inferable; otherwise omit.
memory_summary: 1-3 sentences summarizing the brand for an AI assistant.`,
        },
        {
          role: "user",
          content: `URL: ${ingest.url}
Title: ${ingest.title ?? "(none)"}

Page text:
${ingest.text.slice(0, MAX_TEXT_CHARS)}`,
        },
      ]);

      return this.normalizeProposal(raw);
    } catch (e) {
      const err = e as Error;
      logger.warn(
        "Website proposal mapping failed; using heuristic",
        { error: err?.message ?? String(e), url: ingest.url },
        "WebsiteIngestService"
      );
      return this.heuristicProposal(ingest);
    }
  }

  async ingestAndPropose(
    rawUrl: string,
    signal?: AbortSignal
  ): Promise<{
    url: string;
    proposal: WorkspaceOnboardingProposal;
    summary: string;
    source: "tavily" | "fetch";
    text: string;
  } | null> {
    const ingest = await this.ingest(rawUrl, signal);
    if (!ingest) return null;
    const proposal = await this.mapToProposal(ingest);
    return {
      url: ingest.url,
      proposal,
      summary: formatProposalSummary(proposal, ingest.url),
      source: ingest.source,
      text: ingest.text,
    };
  }

  private normalizeProposal(raw: z.infer<typeof proposalSchema>): WorkspaceOnboardingProposal {
    const cleanList = (arr: string[] | null | undefined) =>
      (arr ?? [])
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 20);

    const wordCount = raw.default_word_count != null ? parseDefaultWordCount(raw.default_word_count) : undefined;
    const audience = cleanList(raw.target_audience ?? undefined);
    const customers = normalizeCustomers(
      (raw.customers ?? []).map((c) => ({
        who: c.who,
        pain_points: c.pain_points ?? undefined,
        success: c.success ?? undefined,
        label: c.label ?? undefined,
      })),
      audience
    );
    const competitors = normalizeCompetitors(
      (raw.competitors ?? []).map((c) => ({
        name: c.name,
        notes: c.notes ?? undefined,
      })),
      raw.competitive_notes ?? undefined
    );

    return {
      industries: cleanList(raw.industries ?? undefined),
      business_model: raw.business_model ?? undefined,
      business_description: raw.business_description?.trim() || raw.business_type?.trim() || undefined,
      target_audience: audience,
      customers: customers.length ? customers : undefined,
      brand_voice: raw.brand_voice?.trim() || undefined,
      brand_negatives: raw.brand_negatives?.trim() || undefined,
      business_goals: cleanList(raw.business_goals ?? undefined),
      seo_priorities: cleanList(raw.seo_priorities ?? undefined),
      publishing_channels: cleanList(raw.publishing_channels ?? undefined),
      competitors: competitors.length ? competitors : undefined,
      tone: raw.tone?.trim() || undefined,
      default_word_count: wordCount,
      memory_summary: raw.memory_summary?.trim() || undefined,
    };
  }

  private heuristicProposal(ingest: WebsiteIngestResult): WorkspaceOnboardingProposal {
    const snippet = ingest.text.replace(/\s+/g, " ").trim().slice(0, 280);
    return {
      business_description: snippet || undefined,
      memory_summary: snippet || undefined,
    };
  }

  private async fetchPageText(url: string, signal?: AbortSignal): Promise<{ title?: string; text: string } | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    const onAbort = () => controller.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": "BloggrWorkspaceBot/1.0 (+https://bloggr.app)",
          Accept: "text/html,application/xhtml+xml",
        },
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const contentType = res.headers.get("content-type") || "";
      if (!/text\/html|application\/xhtml/i.test(contentType) && contentType) {
        // Still try if content-type missing; skip obvious non-HTML.
        if (/json|image|pdf|octet-stream/i.test(contentType)) return null;
      }

      const buf = await res.arrayBuffer();
      if (buf.byteLength > FETCH_MAX_BYTES) {
        logger.warn("Website fetch too large", { url, bytes: buf.byteLength }, "WebsiteIngestService");
        return null;
      }
      const html = new TextDecoder("utf-8", { fatal: false }).decode(buf);
      return this.htmlToText(html);
    } catch (e) {
      const err = e as Error;
      logger.warn("Website fetch failed", { url, error: err?.message ?? String(e) }, "WebsiteIngestService");
      return null;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  private htmlToText(html: string): { title?: string; text: string } {
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.replace(/\s+/g, " ").trim().slice(0, 300);

    let cleaned = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<\/(p|div|h[1-6]|li|tr|br|section|article)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/gi, "&")
      .replace(/&lt;/gi, "<")
      .replace(/&gt;/gi, ">")
      .replace(/&#39;/gi, "'")
      .replace(/&quot;/gi, '"');

    cleaned = cleaned
      .split("\n")
      .map((l) => l.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .join("\n")
      .trim();

    return { title, text: cleaned.slice(0, MAX_TEXT_CHARS) };
  }
}

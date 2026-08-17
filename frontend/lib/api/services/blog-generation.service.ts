import apiClient from "../client";
import { API_CONFIG, API_ENDPOINTS } from "../config";
import { ensureAccessTokenFresh, SessionRefreshFailedError } from "../token-refresh";
import { useAuthStore } from "../../store/auth.store";
import { AxiosRequestConfig } from "axios";
import type { PostEnrichment, PostOutline, TopicSuggestion } from "@/lib/types/interactive-post";

export interface PromptAnalysis {
  topic: string;
  domain: string;
  target_audience: string;
  purpose: string;
  structure?: string;
  word_count?: number;
  tone?: string;
  topics_to_explore?: string[];
  is_valid: boolean;
  rejection_reason?: string;
}

export interface GeneratedBlogContent {
  title: string;
  content: string;
  excerpt: string;
  meta?: {
    description?: string;
    keywords?: string[];
  };
}

export interface GenerateBlogResponse {
  content: GeneratedBlogContent;
  analysis: PromptAnalysis;
  review?: unknown;
  reviewError?: {
    message: string;
    type: string;
  };
  campaign_id?: string;
}

export interface AnalyzePromptOptions {
  signal?: AbortSignal;
  tone?: string;
  target_audience?: string;
  topics_to_explore?: string[];
  word_count?: number;
  purpose?: string;
  structure?: string;
  length_preset?: "short" | "medium" | "long";
}

export type InteractiveGenerateOptions = {
  signal?: AbortSignal;
  analysis?: PromptAnalysis;
  enrichment?: PostEnrichment;
  approved_outline?: PostOutline;
  campaign_id?: string;
  keywords?: string[];
  post_type?: string;
  onEvent?: (event: string, data: unknown) => void;
};

function requireSiteId(): string {
  if (typeof window === "undefined") {
    throw new Error("Post generation requires a browser context");
  }
  const siteId = useAuthStore.getState().currentSiteId;
  if (!siteId) {
    throw new Error("No workspace selected. Choose a workspace before generating posts.");
  }
  return siteId;
}

function parseSseBlocks(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: Array<{ event: string; data: string }> = [];
  for (const block of parts) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data += line.slice(5).trim();
      }
    }
    if (data) {
      events.push({ event, data });
    }
  }
  return { events, rest };
}

export class BlogGenerationService {
  static async suggestTopics(input?: {
    seed_intent?: string;
    campaign_id?: string;
    count?: number;
    signal?: AbortSignal;
  }): Promise<{ topics: TopicSuggestion[]; business_summary: string }> {
    const siteId = requireSiteId();
    const res = await apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE_SUGGEST_TOPICS(siteId),
      {
        seed_intent: input?.seed_intent,
        campaign_id: input?.campaign_id,
        count: input?.count,
      },
      { timeout: 120000, signal: input?.signal }
    );
    return res.data.data;
  }

  static async buildOutline(input: {
    topic: TopicSuggestion;
    enrichment?: PostEnrichment;
    signal?: AbortSignal;
  }): Promise<PostOutline> {
    const siteId = requireSiteId();
    const res = await apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE_OUTLINE(siteId),
      { topic: input.topic, enrichment: input.enrichment },
      { timeout: 180000, signal: input.signal }
    );
    return res.data.data;
  }

  static async analyzePrompt(prompt: string, opts?: AnalyzePromptOptions): Promise<{ data: { data: PromptAnalysis } }> {
    const siteId = requireSiteId();
    const { signal, tone, target_audience, topics_to_explore, word_count, purpose, structure, length_preset } =
      opts ?? {};
    const config: AxiosRequestConfig = { timeout: 120000, signal };
    return apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE_ANALYZE(siteId),
      { prompt, tone, target_audience, topics_to_explore, word_count, purpose, structure, length_preset },
      config
    );
  }

  static async generateBlog(
    prompt: string,
    analysis?: PromptAnalysis,
    signal?: AbortSignal,
    extras?: Omit<InteractiveGenerateOptions, "signal" | "analysis" | "onEvent">
  ): Promise<{ data: { data: GenerateBlogResponse } }> {
    const siteId = requireSiteId();
    return apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE(siteId),
      {
        prompt,
        analysis,
        tone: analysis?.tone ?? extras?.enrichment?.tone,
        target_audience: analysis?.target_audience ?? extras?.enrichment?.target_audience,
        topics_to_explore: analysis?.topics_to_explore ?? extras?.keywords,
        word_count: analysis?.word_count ?? extras?.enrichment?.word_count,
        purpose: extras?.approved_outline ? undefined : analysis?.purpose?.slice(0, 120),
        structure: extras?.approved_outline ? undefined : analysis?.structure?.slice(0, 120),
        enrichment: extras?.enrichment,
        approved_outline: extras?.approved_outline,
        campaign_id: extras?.campaign_id ?? extras?.approved_outline?.campaign_id,
        keywords: extras?.keywords ?? extras?.approved_outline?.keywords,
        post_type: extras?.post_type ?? extras?.approved_outline?.post_type,
        content_archetype: extras?.approved_outline?.content_archetype,
        style_variant: extras?.enrichment?.style_variant ?? extras?.approved_outline?.style_variant,
        length_preset: extras?.enrichment?.length_preset,
      },
      { timeout: 180000, signal }
    );
  }

  static async generateBlogStream(
    prompt: string,
    analysis: PromptAnalysis | undefined,
    options: InteractiveGenerateOptions = {}
  ): Promise<GenerateBlogResponse> {
    const siteId = requireSiteId();
    if (typeof window !== "undefined") {
      try {
        await ensureAccessTokenFresh();
      } catch (e) {
        if (e instanceof SessionRefreshFailedError) throw new Error("Authentication required");
        throw e;
      }
    }
    const url = `${API_CONFIG.baseURL}${API_ENDPOINTS.BLOGS.GENERATE_STREAM(siteId)}`;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const { getCorrelationHeaders } = await import("@/lib/observability/request-headers");
    const correlation = getCorrelationHeaders();
    const hasApprovedOutline = !!options.approved_outline;
    // When an approved outline is present, full thesis/structure live there (and in
    // context_pack server-side). Flat purpose/structure are capped at 120 by Zod.
    const body = {
      prompt,
      analysis: analysis ?? options.analysis,
      tone: analysis?.tone ?? options.enrichment?.tone,
      target_audience: analysis?.target_audience ?? options.enrichment?.target_audience,
      topics_to_explore: analysis?.topics_to_explore ?? options.keywords,
      word_count: analysis?.word_count ?? options.enrichment?.word_count,
      purpose: hasApprovedOutline ? undefined : analysis?.purpose?.slice(0, 120),
      structure: hasApprovedOutline ? undefined : analysis?.structure?.slice(0, 120),
      enrichment: options.enrichment,
      approved_outline: options.approved_outline,
      campaign_id: options.campaign_id ?? options.approved_outline?.campaign_id,
      keywords: options.keywords ?? options.approved_outline?.keywords,
      post_type: options.post_type ?? options.approved_outline?.post_type,
      content_archetype: options.approved_outline?.content_archetype,
      style_variant: options.enrichment?.style_variant ?? options.approved_outline?.style_variant,
      length_preset: options.enrichment?.length_preset,
    };
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...correlation,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    if (!res.ok) {
      const raw = await res.text();
      let message = `Generation failed (${res.status})`;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (j?.message) message = j.message;
      } catch {
        if (raw) message = raw.slice(0, 200);
      }
      throw new Error(message);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from stream");

    const decoder = new TextDecoder();
    let carry = "";
    let finalPayload: GenerateBlogResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBlocks(carry);
      carry = rest;
      for (const ev of events) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(ev.data) as unknown;
        } catch {
          parsed = ev.data;
        }
        options.onEvent?.(ev.event, parsed);
        if (ev.event === "final" && parsed && typeof parsed === "object") {
          finalPayload = parsed as GenerateBlogResponse;
        }
      }
    }

    const tail = parseSseBlocks(carry.endsWith("\n\n") ? carry : `${carry}\n\n`);
    for (const ev of tail.events) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data) as unknown;
      } catch {
        parsed = ev.data;
      }
      options.onEvent?.(ev.event, parsed);
      if (ev.event === "final" && parsed && typeof parsed === "object") {
        finalPayload = parsed as GenerateBlogResponse;
      }
    }

    if (!finalPayload) throw new Error("Stream ended without a final result");
    return finalPayload;
  }

  static async generateBlogBackground(
    prompt: string,
    analysis: PromptAnalysis | undefined,
    extras?: Omit<InteractiveGenerateOptions, "signal" | "analysis" | "onEvent">
  ): Promise<{ blog_id: string }> {
    const siteId = requireSiteId();
    const hasApprovedOutline = !!extras?.approved_outline;
    const res = await apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE_BACKGROUND(siteId),
      {
        prompt,
        analysis,
        tone: analysis?.tone ?? extras?.enrichment?.tone,
        target_audience: analysis?.target_audience ?? extras?.enrichment?.target_audience,
        topics_to_explore: analysis?.topics_to_explore ?? extras?.keywords,
        word_count: analysis?.word_count ?? extras?.enrichment?.word_count,
        purpose: hasApprovedOutline ? undefined : analysis?.purpose?.slice(0, 120),
        structure: hasApprovedOutline ? undefined : analysis?.structure?.slice(0, 120),
        enrichment: extras?.enrichment,
        approved_outline: extras?.approved_outline,
        campaign_id: extras?.campaign_id ?? extras?.approved_outline?.campaign_id,
        keywords: extras?.keywords ?? extras?.approved_outline?.keywords,
        post_type: extras?.post_type ?? extras?.approved_outline?.post_type,
        content_archetype: extras?.approved_outline?.content_archetype,
        style_variant: extras?.enrichment?.style_variant ?? extras?.approved_outline?.style_variant,
        length_preset: extras?.enrichment?.length_preset,
      },
      { timeout: 60000 }
    );
    return res.data.data as { blog_id: string };
  }
}

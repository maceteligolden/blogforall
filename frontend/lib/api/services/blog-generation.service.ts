import apiClient from "../client";
import { API_CONFIG, API_ENDPOINTS } from "../config";
import { ensureAccessTokenFresh, SessionRefreshFailedError } from "../token-refresh";
import { useAuthStore } from "../../store/auth.store";
import { AxiosRequestConfig } from "axios";

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

function requireSiteId(): string {
  if (typeof window === "undefined") {
    throw new Error("Blog generation requires a browser context");
  }
  const siteId = useAuthStore.getState().currentSiteId;
  if (!siteId) {
    throw new Error("No workspace selected. Choose a site before generating blogs.");
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
  static async analyzePrompt(
    prompt: string,
    opts?: AnalyzePromptOptions
  ): Promise<{ data: { data: PromptAnalysis } }> {
    const siteId = requireSiteId();
    const { signal, tone, target_audience, topics_to_explore, word_count, purpose, structure, length_preset } =
      opts ?? {};
    const config: AxiosRequestConfig = {
      timeout: 120000,
      signal,
    };
    return apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE_ANALYZE(siteId),
      {
        prompt,
        tone,
        target_audience,
        topics_to_explore,
        word_count,
        purpose,
        structure,
        length_preset,
      },
      config
    );
  }

  static async generateBlog(
    prompt: string,
    analysis?: PromptAnalysis,
    signal?: AbortSignal
  ): Promise<{ data: { data: GenerateBlogResponse } }> {
    const siteId = requireSiteId();
    const config: AxiosRequestConfig = {
      timeout: 180000,
      signal,
    };
    return apiClient.post(
      API_ENDPOINTS.BLOGS.GENERATE(siteId),
      {
        prompt,
        analysis,
        tone: analysis?.tone,
        target_audience: analysis?.target_audience,
        topics_to_explore: analysis?.topics_to_explore,
        word_count: analysis?.word_count,
        purpose: analysis?.purpose,
        structure: analysis?.structure,
      },
      config
    );
  }

  /**
   * Streamed generation (SSE). Resolves with the same shape as generateBlog when `final` is received.
   */
  static async generateBlogStream(
    prompt: string,
    analysis: PromptAnalysis | undefined,
    options: {
      signal?: AbortSignal;
      onEvent?: (event: string, data: unknown) => void;
    } = {}
  ): Promise<GenerateBlogResponse> {
    const siteId = requireSiteId();
    if (typeof window !== "undefined") {
      try {
        await ensureAccessTokenFresh();
      } catch (e) {
        if (e instanceof SessionRefreshFailedError) {
          throw new Error("Authentication required");
        }
        throw e;
      }
    }
    const url = `${API_CONFIG.baseURL}${API_ENDPOINTS.BLOGS.GENERATE_STREAM(siteId)}`;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        prompt,
        analysis,
        tone: analysis?.tone,
        target_audience: analysis?.target_audience,
        topics_to_explore: analysis?.topics_to_explore,
        word_count: analysis?.word_count,
        purpose: analysis?.purpose,
        structure: analysis?.structure,
      }),
      signal: options.signal,
    });

    if (!res.ok) {
      const raw = await res.text();
      let message = `Generation failed (${res.status})`;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (j?.message) {
          message = j.message;
        }
      } catch {
        if (raw) {
          message = raw.slice(0, 200);
        }
      }
      throw new Error(message);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("No response body from stream");
    }

    const decoder = new TextDecoder();
    let carry = "";
    let finalPayload: GenerateBlogResponse | null = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
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

    if (!finalPayload) {
      throw new Error("Stream ended without a final result");
    }
    return finalPayload;
  }
}

import { injectable } from "tsyringe";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import type { BlogUserGenerationParams, GeneratedBlogContent, PromptAnalysis, ResearchNote } from "./types";
import { TavilySearchService } from "./tavily-search.service";
import { runBlogReviewWithChat, type BlogReviewResult } from "./blog-review.runner";

const AnalysisSchema = z.object({
  topic: z.string(),
  domain: z.string(),
  target_audience: z.string(),
  purpose: z.string(),
  /** OpenAI structured outputs: use nullable, not optional-only. */
  structure: z.string().nullable(),
  has_clear_topic: z.boolean(),
  word_count: z.number().nullable(),
});

const DraftSchema = z.object({
  title: z.string(),
  content: z.string(),
  excerpt: z.string(),
  meta: z
    .object({
      description: z.string().nullable(),
      keywords: z.array(z.string()).nullable(),
    })
    .nullable(),
});

const BlogGenState = Annotation.Root({
  prompt: Annotation<string>(),
  userParams: Annotation<BlogUserGenerationParams | undefined>(),
  analysis: Annotation<PromptAnalysis | null>(),
  researchNotes: Annotation<ResearchNote[]>(),
  draft: Annotation<GeneratedBlogContent | null>(),
  review: Annotation<BlogReviewResult | null>(),
});

type BlogGenStateType = typeof BlogGenState.State;
type BlogGenUpdate = typeof BlogGenState.Update;

@injectable()
export class BlogGenerationGraphService {
  /** Compiled graph instance (cached). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private compiled: any = null;

  constructor(private readonly tavilySearch: TavilySearchService) {}

  assertConfigured(): void {
    if (!BlogAiConfig.openaiApiKey) {
      throw new BadRequestError(
        "AI blog generation is not configured. Set OPENAI_API_KEY or BLOG_AI_OPENAI_API_KEY in the server environment."
      );
    }
  }

  private getMainChat(): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.chatModel,
      timeout: BlogAiConfig.API_TIMEOUT,
      maxRetries: 1,
      temperature: 0.35,
    });
  }

  private getReviewChat(): ChatOpenAI {
    return new ChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.reviewModel,
      timeout: BlogAiConfig.API_TIMEOUT,
      maxRetries: 1,
      temperature: 0.25,
    });
  }

  private getGraph() {
    if (this.compiled) {
      return this.compiled;
    }
    const graph = new StateGraph(BlogGenState)
      .addNode("validate", (s, c) => this.nodeValidate(s, c))
      .addNode("mergeParams", (s, c) => this.nodeMergeParams(s, c))
      .addNode("research", (s, c) => this.nodeResearch(s, c))
      // Node names must differ from state channels (`draft`, `review` in BlogGenState).
      .addNode("writeDraft", (s, c) => this.nodeDraft(s, c))
      .addNode("editorialReview", (s, c) => this.nodeReview(s, c))
      .addConditionalEdges(START, (s) => (s.analysis?.is_valid ? "mergeParams" : "validate"), {
        validate: "validate",
        mergeParams: "mergeParams",
      })
      .addConditionalEdges("validate", (s) => (s.analysis?.is_valid ? "mergeParams" : END), {
        mergeParams: "mergeParams",
        [END]: END,
      })
      .addEdge("mergeParams", "research")
      .addEdge("research", "writeDraft")
      .addEdge("writeDraft", "editorialReview")
      .addEdge("editorialReview", END);
    this.compiled = graph.compile();
    return this.compiled;
  }

  /**
   * Run prompt validation only (analyze endpoint).
   */
  async analyzePrompt(
    prompt: string,
    userParams: BlogUserGenerationParams | undefined,
    signal?: AbortSignal
  ): Promise<PromptAnalysis> {
    this.assertConfigured();
    if (!prompt || !prompt.trim()) {
      throw new BadRequestError(
        "Please enter a prompt describing what you'd like to write about. For example: 'Write a guide about React hooks for beginners'."
      );
    }
    if (prompt.length > BlogAiConfig.MAX_PROMPT_LENGTH) {
      throw new BadRequestError(
        `Your prompt is too long (${prompt.length} characters). Please keep it under ${BlogAiConfig.MAX_PROMPT_LENGTH} characters.`
      );
    }
    return this.runValidateNode(prompt.trim(), userParams, signal);
  }

  /**
   * Full pipeline: merge → research → draft → review. Caller must pass valid `analysis`.
   */
  async generateFull(
    prompt: string,
    analysis: PromptAnalysis,
    userParams: BlogUserGenerationParams | undefined,
    signal?: AbortSignal
  ): Promise<{
    content: GeneratedBlogContent;
    analysis: PromptAnalysis;
    review: BlogReviewResult;
  }> {
    this.assertConfigured();
    if (!analysis.is_valid) {
      throw new BadRequestError(
        analysis.rejection_reason ||
          "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
      );
    }
    const graph = this.getGraph();
    const initial: BlogGenStateType = {
      prompt: prompt.trim(),
      userParams,
      analysis,
      researchNotes: [],
      draft: null,
      review: null,
    };
    const out = await graph.invoke(initial, { signal });
    if (!out.draft) {
      throw new BadRequestError("Blog generation did not produce content. Please try again.");
    }
    if (!out.review) {
      throw new BadRequestError("Blog review step did not complete. Please try again.");
    }
    return { content: out.draft, analysis: out.analysis!, review: out.review };
  }

  /**
   * Stream draft body tokens over SSE; runs merge + research sync first, then streams draft, then review sync.
   */
  async streamGenerate(
    prompt: string,
    analysis: PromptAnalysis,
    userParams: BlogUserGenerationParams | undefined,
    signal: AbortSignal | undefined,
    emit: (event: string, data: unknown) => void
  ): Promise<{ content: GeneratedBlogContent; analysis: PromptAnalysis; review: BlogReviewResult }> {
    this.assertConfigured();
    if (!analysis.is_valid) {
      throw new BadRequestError(
        analysis.rejection_reason ||
          "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
      );
    }
    const merged = await this.nodeMergeParams(
      {
        prompt: prompt.trim(),
        userParams,
        analysis,
        researchNotes: [],
        draft: null,
        review: null,
      },
      { signal }
    );
    const mergedAnalysis = merged.analysis ?? analysis;
    emit("phase", { step: "research" });
    const researchOut = await this.nodeResearch(
      {
        prompt: prompt.trim(),
        userParams,
        analysis: mergedAnalysis,
        researchNotes: [],
        draft: null,
        review: null,
      },
      { signal }
    );
    const researchNotes = researchOut.researchNotes ?? [];
    emit("research", { count: researchNotes.length, titles: researchNotes.map((r) => r.title).slice(0, 5) });

    emit("phase", { step: "draft" });
    const chat = this.getMainChat();
    const structured = chat.withStructuredOutput(DraftSchema);
    const draftPrompt = this.buildDraftPrompt(prompt.trim(), mergedAnalysis, researchNotes);
    const stream = await structured.stream([new HumanMessage(draftPrompt)], { signal });
    let last: z.infer<typeof DraftSchema> | null = null;
    for await (const chunk of stream) {
      last = chunk as z.infer<typeof DraftSchema>;
      emit("draft_partial", { title: last.title, contentLen: last.content?.length ?? 0 });
    }
    if (!last?.content) {
      throw new BadRequestError("The model returned empty content. Please try again.");
    }
    const draft: GeneratedBlogContent = {
      title: last.title,
      content: last.content,
      excerpt: last.excerpt,
      meta: this.normalizeDraftMeta(last.meta),
    };
    this.validateDraft(draft, mergedAnalysis);

    emit("phase", { step: "review" });
    let review: BlogReviewResult;
    try {
      review = await runBlogReviewWithChat(
        this.getReviewChat(),
        draft.title,
        draft.content,
        draft.excerpt,
        undefined,
        undefined,
        researchNotes,
        signal
      );
    } catch (e) {
      logger.warn("Stream review failed", { error: (e as Error).message }, "BlogGenerationGraphService");
      review = {
        overall_score: 70,
        scores: {
          readability: 70,
          seo: 70,
          grammar: 70,
          structure: 70,
          fact_check: 70,
          style: 70,
          engagement: 70,
        },
        suggestions: [],
        summary: "Automatic review could not be completed. Use the 'Review with AI' button for a full editorial pass.",
      };
    }

    emit("final", {
      content: draft,
      analysis: mergedAnalysis,
      review,
    });
    return { content: draft, analysis: mergedAnalysis, review };
  }

  private async nodeValidate(state: BlogGenStateType, config?: RunnableConfig): Promise<BlogGenUpdate> {
    const analysis = await this.runValidateNode(state.prompt, state.userParams, config?.signal);
    return { analysis };
  }

  private async runValidateNode(
    prompt: string,
    userParams: BlogUserGenerationParams | undefined,
    signal?: AbortSignal
  ): Promise<PromptAnalysis> {
    const chat = this.getMainChat();
    const structured = chat.withStructuredOutput(AnalysisSchema);
    const hints =
      userParams &&
      (userParams.tone ||
        userParams.target_audience ||
        userParams.topics_to_explore?.length ||
        userParams.word_count != null ||
        (userParams.purpose && userParams.purpose.trim()) ||
        (userParams.structure && userParams.structure.trim()))
        ? `\n\nUSER PARAMETERS (respect when inferring audience, purpose, structure, length, and scope):\n${JSON.stringify(userParams)}`
        : "";
    const analysisPrompt = `You are an expert blog content analyst. Analyze the user prompt and extract JSON fields.

USER PROMPT:
"${prompt}"
${hints}

Rules:
- has_clear_topic false if vague, off-topic, not a blog subject, or random (e.g. "hello", "what time").
- topic must be specific when has_clear_topic is true.
- domain is a broad category (Technology, Health, Finance, etc.).

Return structured output matching the schema.`;

    const out = await structured.invoke([new HumanMessage(analysisPrompt)], { signal });
    const wordFromPrompt = this.extractWordCount(prompt);
    const analysis: PromptAnalysis = {
      topic: out.topic,
      domain: out.domain || "General",
      target_audience: userParams?.target_audience?.trim() || out.target_audience || "general public",
      purpose: (userParams?.purpose && userParams.purpose.trim()) || out.purpose || "inform",
      structure: (userParams?.structure && userParams.structure.trim()) || out.structure || undefined,
      word_count: userParams?.word_count ?? out.word_count ?? wordFromPrompt ?? undefined,
      tone: userParams?.tone?.trim() || undefined,
      topics_to_explore: userParams?.topics_to_explore?.length ? userParams.topics_to_explore : undefined,
      is_valid: out.has_clear_topic !== false && !!out.topic?.trim(),
      rejection_reason:
        out.has_clear_topic === false || !out.topic?.trim()
          ? "Your prompt doesn't contain a clear topic for a blog post. Please specify what you'd like to write about."
          : undefined,
    };

    if (!analysis.topic?.trim()) {
      analysis.is_valid = false;
      analysis.rejection_reason =
        "We couldn't identify a clear topic from your prompt. Please be more specific. For example: 'Write a guide about React hooks for beginners'.";
    }

    logger.info(
      "Prompt analyzed (LangGraph)",
      { topic: analysis.topic, isValid: analysis.is_valid },
      "BlogGenerationGraphService"
    );
    return analysis;
  }

  private async nodeMergeParams(state: BlogGenStateType, _config?: RunnableConfig): Promise<BlogGenUpdate> {
    const a = state.analysis;
    if (!a?.is_valid) {
      throw new BadRequestError(a?.rejection_reason || "Invalid prompt analysis.");
    }
    const u = state.userParams ?? {};
    const wordCount =
      u.word_count ?? a.word_count ?? this.extractWordCount(state.prompt) ?? BlogAiConfig.DEFAULT_MAX_WORDS;
    const merged: PromptAnalysis = {
      ...a,
      word_count: wordCount,
      target_audience: u.target_audience?.trim() || a.target_audience,
      tone: u.tone?.trim() || a.tone,
      topics_to_explore:
        u.topics_to_explore && u.topics_to_explore.length > 0
          ? u.topics_to_explore.map((t) => t.trim()).filter(Boolean)
          : a.topics_to_explore,
      purpose: u.purpose?.trim() || a.purpose,
      structure: u.structure?.trim() || a.structure,
    };
    return { analysis: merged };
  }

  private async nodeResearch(state: BlogGenStateType, config?: RunnableConfig): Promise<BlogGenUpdate> {
    const a = state.analysis!;
    const q = this.tavilySearch.buildQuery(state.prompt, a.topic, a.topics_to_explore);
    const notes = await this.tavilySearch.search(q, config?.signal);
    return { researchNotes: notes };
  }

  private async nodeDraft(state: BlogGenStateType, config?: RunnableConfig): Promise<BlogGenUpdate> {
    const chat = this.getMainChat();
    const structured = chat.withStructuredOutput(DraftSchema);
    const prompt = this.buildDraftPrompt(state.prompt, state.analysis!, state.researchNotes);
    const out = await structured.invoke([new HumanMessage(prompt)], { signal: config?.signal });
    const draft: GeneratedBlogContent = {
      title: out.title,
      content: out.content,
      excerpt: out.excerpt,
      meta: this.normalizeDraftMeta(out.meta),
    };
    this.validateDraft(draft, state.analysis!);
    return { draft };
  }

  private async nodeReview(state: BlogGenStateType, config?: RunnableConfig): Promise<BlogGenUpdate> {
    const draft = state.draft!;
    try {
      const review = await runBlogReviewWithChat(
        this.getReviewChat(),
        draft.title,
        draft.content,
        draft.excerpt,
        undefined,
        undefined,
        state.researchNotes,
        config?.signal
      );
      return { review };
    } catch (e) {
      logger.warn(
        "Review node failed; returning placeholder",
        { error: (e as Error).message },
        "BlogGenerationGraphService"
      );
      const fallback: BlogReviewResult = {
        overall_score: 70,
        scores: {
          readability: 70,
          seo: 70,
          grammar: 70,
          structure: 70,
          fact_check: 70,
          style: 70,
          engagement: 70,
        },
        suggestions: [],
        summary: "Automatic review could not be completed. Use the 'Review with AI' button for a full editorial pass.",
      };
      return { review: fallback };
    }
  }

  private buildDraftPrompt(prompt: string, analysis: PromptAnalysis, researchNotes: ResearchNote[]): string {
    const wordCount = analysis.word_count ?? BlogAiConfig.DEFAULT_MAX_WORDS;
    const structure = analysis.structure || "clear sections with headings";
    const topicsLine =
      analysis.topics_to_explore && analysis.topics_to_explore.length > 0
        ? `Topics to cover: ${analysis.topics_to_explore.join(", ")}`
        : "";
    const toneLine = analysis.tone ? `Tone: ${analysis.tone}` : "";
    const researchBlock =
      researchNotes.length > 0
        ? `
GROUNDED RESEARCH (only use facts supported here; do not invent sources):
${researchNotes.map((n, i) => `[${i + 1}] ${n.title}\nURL: ${n.url}\n${n.snippet}`).join("\n\n")}
`
        : `
No web research results were returned. Write from general knowledge and avoid specific recent statistics or news unless widely known.
`;

    return `You are an expert ${analysis.domain} blogger writing for ${analysis.target_audience}.
${toneLine}
Purpose: ${analysis.purpose}
Topic: ${analysis.topic}
USER REQUEST: "${prompt}"
${topicsLine}
Structure: ${structure}
Target length: approximately ${wordCount} words.
${researchBlock}

Write a comprehensive blog post. Use HTML for content: h1 once for title inside content or start with h2 sections, paragraphs, lists as appropriate.

Return structured JSON fields: title (max ~60 chars), content (HTML), excerpt (<=150 words), meta.description (<=160 chars), meta.keywords (array).`;
  }

  private normalizeDraftMeta(meta: z.infer<typeof DraftSchema>["meta"]): GeneratedBlogContent["meta"] {
    if (meta == null) return undefined;
    if (meta.description == null && meta.keywords == null) return undefined;
    return {
      ...(meta.description != null ? { description: meta.description } : {}),
      ...(meta.keywords != null ? { keywords: meta.keywords } : {}),
    };
  }

  private validateDraft(content: GeneratedBlogContent, analysis: PromptAnalysis): void {
    if (!content.title?.trim()) {
      throw new BadRequestError("The generated blog post is missing a title. Please try regenerating.");
    }
    if (!content.content?.trim()) {
      throw new BadRequestError("No content was generated. Please try again with a more detailed prompt.");
    }
    const len = content.content.trim().length;
    if (len < BlogAiConfig.MIN_CONTENT_LENGTH) {
      throw new BadRequestError(
        `The generated content is too short (${len} characters). Try a more detailed prompt or increase target length.`
      );
    }
    if (len > BlogAiConfig.MAX_CONTENT_LENGTH) {
      logger.warn("Generated content exceeds maximum length", { len }, "BlogGenerationGraphService");
    }
    if (analysis.word_count) {
      const words = content.content.split(/\s+/).filter((w) => w.length > 0).length;
      const requested = analysis.word_count;
      const tolerance = Math.max(200, requested * 0.3);
      if (words < requested - tolerance) {
        logger.warn(
          "Generated word count below target (content still returned)",
          { requested, words, tolerance },
          "BlogGenerationGraphService"
        );
      }
    }
  }

  private extractWordCount(text: string): number | undefined {
    const patterns = [/(\d+)\s*words?/i, /approximately\s*(\d+)\s*words?/i, /around\s*(\d+)\s*words?/i];
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        const count = parseInt(match[1], 10);
        if (count >= 300 && count <= 8000) {
          return count;
        }
      }
    }
    return undefined;
  }
}

import { injectable } from "tsyringe";
import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { ChatOpenAI } from "@langchain/openai";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { HumanMessage } from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import { z } from "zod";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import type { BlogUserGenerationParams, GeneratedBlogContent, PromptAnalysis, ResearchNote } from "./types";
import { emptyResearchGuidance, buildStyleAwareDraftPreamble } from "./post-format-prompt";
import { resolveStyleProfile } from "./contracts/style-profile";
import { coerceContentArchetype } from "./contracts/content-archetype";
import { formatRoutedNotesForPrompt, routeResearchNotes } from "./contracts/signal-router";
import { TavilySearchService } from "./tavily-search.service";
import { ResearchGraphService } from "../../orchestratorv2/research/research-graph.service";
import { formatPackageForPrompt } from "../../orchestratorv2/research/research-package.mapper";
import { ArtifactStoreService } from "../../orchestrator/ai/memory/artifact-store.service";
import { runBlogReviewWithChat, type BlogReviewResult } from "./blog-review.runner";
import { clampBlogExcerpt } from "../utils/excerpt.util";
import { ensureHtmlContent } from "../../../shared/utils/content-blocks.util";

const OutlineSchema = z.object({
  title: z.string(),
  sections: z
    .array(z.object({ heading: z.string(), summary: z.string() }))
    .min(2)
    .max(8),
});

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
  excerpt: z.string().max(500),
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

  constructor(
    private readonly tavilySearch: TavilySearchService,
    private readonly researchGraph: ResearchGraphService,
    private readonly artifacts: ArtifactStoreService
  ) {}

  assertConfigured(): void {
    if (!BlogAiConfig.openaiApiKey) {
      throw new BadRequestError(
        "AI blog generation is not configured. Set OPENAI_API_KEY or BLOG_AI_OPENAI_API_KEY in the server environment."
      );
    }
  }

  private getMainChat(): ChatOpenAI {
    return createChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.chatModel,
      timeout: BlogAiConfig.API_TIMEOUT,
      temperature: 0.35,
    });
  }

  private getReviewChat(): ChatOpenAI {
    return createChatOpenAI({
      apiKey: BlogAiConfig.openaiApiKey,
      model: BlogAiConfig.reviewModel,
      timeout: BlogAiConfig.API_TIMEOUT,
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
   * Draft-only path for Writing skill (ADR-004): uses provided research notes
   * and never calls Tavily / editorial review. Content Optimization owns review.
   */
  async draftFromNotes(
    prompt: string,
    analysis: PromptAnalysis,
    researchNotes: ResearchNote[],
    userParams?: BlogUserGenerationParams,
    signal?: AbortSignal
  ): Promise<GeneratedBlogContent> {
    this.assertConfigured();
    if (!analysis.is_valid) {
      throw new BadRequestError(
        analysis.rejection_reason ||
          "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
      );
    }
    const update = await this.nodeDraft(
      {
        prompt: prompt.trim(),
        userParams,
        analysis,
        researchNotes,
        draft: null,
        review: null,
      },
      { signal }
    );
    if (!update.draft) {
      throw new BadRequestError("Blog generation did not produce content. Please try again.");
    }
    return update.draft;
  }

  /**
   * Writing background draft: merge → draft from approved notes → editorial review.
   * Skips the research graph / Tavily — research already ran in writing_request_research.
   */
  async generateFromNotesWithReview(
    prompt: string,
    analysis: PromptAnalysis,
    researchNotes: ResearchNote[],
    userParams?: BlogUserGenerationParams,
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
    const mergedOut = await this.nodeMergeParams(
      {
        prompt: prompt.trim(),
        userParams,
        analysis,
        researchNotes,
        draft: null,
        review: null,
      },
      { signal }
    );
    const mergedAnalysis = mergedOut.analysis ?? analysis;
    const content = await this.draftFromNotes(prompt, mergedAnalysis, researchNotes, userParams, signal);
    const reviewOut = await this.nodeReview(
      {
        prompt: prompt.trim(),
        userParams,
        analysis: mergedAnalysis,
        researchNotes,
        draft: content,
        review: null,
      },
      { signal }
    );
    if (!reviewOut.review) {
      throw new BadRequestError("Blog review step did not complete. Please try again.");
    }
    return { content, analysis: mergedAnalysis, review: reviewOut.review };
  }

  /**
   * Outline-only path for Writing skill — grounded in research notes, no web search.
   */
  async outlineFromNotes(
    prompt: string,
    analysis: PromptAnalysis,
    researchNotes: ResearchNote[],
    userParams?: BlogUserGenerationParams,
    signal?: AbortSignal
  ): Promise<{ title: string; sections: Array<{ heading: string; summary: string }> }> {
    this.assertConfigured();
    if (!analysis.is_valid) {
      throw new BadRequestError(analysis.rejection_reason || "Prompt analysis is invalid for outline generation.");
    }
    const chat = this.getMainChat();
    const structured = chat.withStructuredOutput(OutlineSchema);
    const outlinePrompt = `Based on the following blog brief, produce ONLY an outline with a title and 3-6 section headings with one-line summaries.

${this.buildDraftPrompt(prompt.trim(), analysis, researchNotes, userParams)}`;
    return structured.invoke([new HumanMessage(outlinePrompt)], { signal });
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
   * Revise an existing blog draft using reviewer feedback. Skips the research
   * and editorial review steps because:
   *  - we already have content (no need for a fresh research pass)
   *  - the reviewer IS the editorial pass; their notes drive the revision
   *
   * Returns a fresh GeneratedBlogContent. The caller is responsible for
   * persisting it back to the blog row. Falls back to the original content
   * if the model returns empty output rather than failing the rework loop.
   */
  async regenerateWithFeedback(input: {
    title: string;
    content: string;
    excerpt?: string;
    feedback: string;
    userParams?: BlogUserGenerationParams;
    signal?: AbortSignal;
  }): Promise<GeneratedBlogContent> {
    this.assertConfigured();
    const trimmedFeedback = (input.feedback ?? "").trim();
    if (!trimmedFeedback) {
      throw new BadRequestError("Reviewer feedback is required for regeneration.");
    }
    const chat = this.getMainChat();
    const structured = chat.withStructuredOutput(DraftSchema);
    const prompt = this.buildReworkPrompt({
      originalTitle: input.title,
      originalContent: input.content,
      originalExcerpt: input.excerpt,
      feedback: trimmedFeedback,
      userParams: input.userParams,
    });
    const out = await structured.invoke([new HumanMessage(prompt)], { signal: input.signal });
    const revised: GeneratedBlogContent = {
      title: out.title?.trim() || input.title,
      content: out.content?.trim() || input.content,
      excerpt: out.excerpt?.trim() || input.excerpt || "",
      meta: this.normalizeDraftMeta(out.meta),
    };
    if (!revised.content?.trim()) {
      logger.warn("Rework regeneration returned empty content; returning original", {}, "BlogGenerationGraphService");
      return {
        title: input.title,
        content: input.content,
        excerpt: input.excerpt ?? "",
      };
    }
    return revised;
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

    if (userParams?.approved_outline_sections?.length) {
      emit("phase", { step: "outline_locked", sections: userParams.approved_outline_sections.length });
    }

    emit("phase", { step: "draft" });

    let draft: GeneratedBlogContent;
    if (userParams?.context_pack?.trim() && userParams.approved_outline_sections?.length) {
      const sectional = await this.nodeDraftSectional(
        {
          prompt: prompt.trim(),
          userParams,
          analysis: mergedAnalysis,
          researchNotes,
          draft: null,
          review: null,
        },
        { signal }
      );
      draft = sectional.draft!;
      emit("draft_partial", { title: draft.title, contentLen: draft.content?.length ?? 0 });
    } else {
      const chat = this.getMainChat();
      const structured = chat.withStructuredOutput(DraftSchema);
      const draftPrompt = this.buildDraftPrompt(prompt.trim(), mergedAnalysis, researchNotes, userParams);
      const stream = await structured.stream([new HumanMessage(draftPrompt)], { signal });
      let last: z.infer<typeof DraftSchema> | null = null;
      for await (const chunk of stream) {
        last = chunk as z.infer<typeof DraftSchema>;
        emit("draft_partial", { title: last.title, contentLen: last.content?.length ?? 0 });
      }
      if (!last?.content) {
        throw new BadRequestError("The model returned empty content. Please try again.");
      }
      draft = {
        title: last.title,
        content: last.content,
        excerpt: last.excerpt,
        meta: this.normalizeDraftMeta(last.meta),
      };
      this.validateDraft(draft, mergedAnalysis);
    }

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
    const topic = a.topic || state.prompt.slice(0, 200);
    const siteId = state.userParams?.site_id;
    if (siteId) {
      try {
        const result = await this.researchGraph.run({
          workspace_id: siteId,
          question: [topic, a.purpose, a.target_audience].filter(Boolean).join(" — "),
          depth: "full",
          purpose: "post",
          audience: a.target_audience,
          persist: true,
          signal: config?.signal,
        });
        const pkg = await this.artifacts.getResearchPackage(siteId, result.package_id);
        const notes: ResearchNote[] = [
          {
            url: `research://${result.package_id}`,
            title: "Research report",
            snippet: (result.report_markdown || (pkg ? formatPackageForPrompt(pkg) : "")).slice(0, 4000),
          },
          ...(pkg?.references ?? []).slice(0, 12).map((r) => ({
            url: r.url,
            title: r.title,
            snippet: pkg?.sources.find((s) => s.id === r.source_id)?.snippet || r.title,
          })),
        ];
        if (notes.length > 1 || notes[0]?.snippet) {
          return { researchNotes: notes };
        }
      } catch (error) {
        logger.warn(
          "Research graph failed in blog generation; falling back to search",
          { error: String(error) },
          "BlogGenerationGraphService"
        );
      }
    }
    const notes = await this.tavilySearch.searchMultiQuery(topic, {
      minSources: 5,
      maxSources: 15,
      signal: config?.signal,
    });
    if (!notes.length) {
      const q = this.tavilySearch.buildQuery(state.prompt, a.topic, a.topics_to_explore);
      const fallback = await this.tavilySearch.search(q, config?.signal);
      return { researchNotes: fallback };
    }
    return { researchNotes: notes };
  }

  private async nodeDraft(state: BlogGenStateType, config?: RunnableConfig): Promise<BlogGenUpdate> {
    if (state.userParams?.context_pack?.trim()) {
      return this.nodeDraftSectional(state, config);
    }
    const chat = this.getMainChat();
    const structured = chat.withStructuredOutput(DraftSchema);
    const prompt = this.buildDraftPrompt(state.prompt, state.analysis!, state.researchNotes, state.userParams);
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

  private async nodeDraftSectional(state: BlogGenStateType, config?: RunnableConfig): Promise<BlogGenUpdate> {
    const chat = this.getMainChat();
    const approved = state.userParams?.approved_outline_sections;
    let outline: { title: string; sections: Array<{ heading: string; summary: string }> };

    if (approved?.length) {
      outline = {
        title: state.userParams?.approved_outline_title || state.analysis!.topic,
        sections: approved.slice(0, 12),
      };
    } else {
      const outlineStructured = chat.withStructuredOutput(OutlineSchema);
      const outlinePrompt = `Based on the following blog brief, produce ONLY an outline with a title and 3-6 section headings with one-line summaries.
Respect the workspace context pack in your outline.

${this.buildDraftPrompt(state.prompt, state.analysis!, state.researchNotes, state.userParams)}`;
      outline = await outlineStructured.invoke([new HumanMessage(outlinePrompt)], { signal: config?.signal });
    }

    const sections: string[] = [];
    let priorSummary = "";

    for (const section of outline.sections.slice(0, 8)) {
      const sectionPrompt = `Write ONE section of a blog post as HTML only (h2 + paragraphs/lists). No Markdown (#, -, **, or code fences). No full article wrapper.

Title: ${outline.title}
Section heading: ${section.heading}
Section goal: ${section.summary}
Prior sections summary: ${priorSummary || "(none yet)"}
Workspace context:
${state.userParams?.context_pack?.slice(0, 3000) ?? ""}

Topic: ${state.analysis!.topic}
Tone: ${state.analysis!.tone ?? "professional"}
Return only the HTML for this section (e.g. <h2>...</h2><p>...</p>).`;

      const sectionOut = await chat.invoke([new HumanMessage(sectionPrompt)], { signal: config?.signal });
      const html = typeof sectionOut.content === "string" ? sectionOut.content : String(sectionOut.content ?? "");
      sections.push(html.trim());
      priorSummary += `${section.heading}: ${section.summary}. `;
    }

    const content = sections.join("\n\n");
    const excerptStructured = chat.withStructuredOutput(
      z.object({ excerpt: z.string(), meta: DraftSchema.shape.meta })
    );
    const excerptOut = await excerptStructured.invoke([
      new HumanMessage(
        `Write an excerpt (max 500 characters, roughly 150 words) and meta for this blog titled "${outline.title}".`
      ),
    ]);

    const draft: GeneratedBlogContent = {
      title: outline.title,
      content,
      excerpt: excerptOut.excerpt ?? "",
      meta: this.normalizeDraftMeta(excerptOut.meta),
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

  private buildReworkPrompt(input: {
    originalTitle: string;
    originalContent: string;
    originalExcerpt?: string;
    feedback: string;
    userParams?: BlogUserGenerationParams;
  }): string {
    const u = input.userParams ?? {};
    const hintLines: string[] = [];
    if (u.tone) hintLines.push(`Tone: ${u.tone}`);
    if (u.target_audience) hintLines.push(`Audience: ${u.target_audience}`);
    if (u.word_count) hintLines.push(`Target length: ~${u.word_count} words`);
    if (u.purpose) hintLines.push(`Purpose: ${u.purpose}`);
    if (u.structure) hintLines.push(`Structure: ${u.structure}`);
    const hintBlock = hintLines.length ? hintLines.join("\n") + "\n\n" : "";
    const excerptBlock = input.originalExcerpt ? `ORIGINAL EXCERPT:\n${input.originalExcerpt}\n\n` : "";

    return `You are an expert editor revising an existing blog draft. Apply the reviewer's feedback faithfully while keeping anything they did NOT ask to change.

${hintBlock}ORIGINAL TITLE: ${input.originalTitle}

${excerptBlock}ORIGINAL CONTENT (HTML):
${input.originalContent}

REVIEWER FEEDBACK:
${input.feedback}

Rules:
- Address every point of the reviewer's feedback.
- Preserve sections the reviewer did not flag.
- Always return the COMPLETE post HTML (every section), never only the rewritten fragment.
- Keep the HTML structure clean (h2 sections, paragraphs, lists as appropriate).
- Do not invent statistics, quotes, or sources that were not already present.
- Update the title only if the feedback explicitly asks for a different angle.

Return structured JSON: title, content (HTML), excerpt (max 500 characters), meta.description (<=160 chars), meta.keywords (array).`;
  }

  private buildDraftPrompt(
    prompt: string,
    analysis: PromptAnalysis,
    researchNotes: ResearchNote[],
    userParams?: BlogUserGenerationParams
  ): string {
    const wordCount = analysis.word_count ?? BlogAiConfig.DEFAULT_MAX_WORDS;
    const structure = analysis.structure || "clear sections with headings";
    const topicsLine =
      analysis.topics_to_explore && analysis.topics_to_explore.length > 0
        ? `Topics to cover: ${analysis.topics_to_explore.join(", ")}`
        : "";
    const toneLine = analysis.tone ? `Tone: ${analysis.tone}` : "";
    const postFormat = userParams?.post_format ?? analysis.post_format;
    const archetype =
      coerceContentArchetype(userParams?.content_archetype) ||
      coerceContentArchetype(analysis.content_archetype) ||
      coerceContentArchetype(userParams?.structure) ||
      coerceContentArchetype(analysis.structure);

    const styleProfile =
      userParams?.style_profile ||
      resolveStyleProfile({
        archetype,
        structure: userParams?.structure ?? analysis.structure,
        purpose: userParams?.purpose ?? analysis.purpose,
        variant: userParams?.style_variant ?? analysis.style_variant,
        audience: userParams?.target_audience ?? analysis.target_audience,
        tone: userParams?.tone ?? analysis.tone,
        personal_notes: userParams?.personal_notes,
        must_include: userParams?.must_include,
        must_avoid: userParams?.must_avoid,
        topic: analysis.topic,
        site_id: userParams?.site_id,
      });

    const routed = routeResearchNotes(
      researchNotes.map((n) => ({
        url: n.url,
        title: n.title,
        snippet: n.snippet,
        source: "web" as const,
      })),
      styleProfile,
      {
        maxKeep: 8,
        mustInclude: userParams?.must_include,
        personalNotes: userParams?.personal_notes,
      }
    );

    const contextBlock = userParams?.context_pack?.trim()
      ? `\nWORKSPACE CONTEXT (brand voice, rules, strategy — follow closely):\n${userParams.context_pack.slice(0, 4000)}\n`
      : "";
    const researchBlock =
      routed.length > 0
        ? `
GROUNDED RESEARCH (only use facts supported here; do not invent sources):
${formatRoutedNotesForPrompt(routed)}
`
        : `
${emptyResearchGuidance(postFormat)}
`;

    const styleBlock = buildStyleAwareDraftPreamble({
      postFormat,
      styleProfile,
      researchBrief: userParams?.research_brief,
      contentArchetype: styleProfile.archetype,
    });

    return `${styleBlock}
${toneLine}
Purpose: ${analysis.purpose}
Topic: ${analysis.topic}
${postFormat ? `Voice format: ${postFormat}` : ""}
Content archetype: ${styleProfile.archetype}
USER REQUEST: "${prompt}"
${topicsLine}
Structure: ${structure}
Target length: approximately ${wordCount} words (archetype floor ~${styleProfile.archetype === "definitive_guide" ? 3000 : 800}+).
${userParams?.must_include ? `Must include: ${userParams.must_include}` : ""}
${userParams?.must_avoid ? `Must avoid: ${userParams.must_avoid}` : ""}
${contextBlock}${researchBlock}

Write the post. content MUST be valid HTML only — use <h2>, <p>, <ul>/<ol>/<li>, <blockquote>, and <table> when the archetype requires a comparison/verdict table. NEVER use Markdown (# headings, - lists, **bold**, or \`\`\` fences).
Avoid stock AI filler and the banned phrases listed in STYLE PROFILE. Prefer concrete scenes and the user's phrasing when present in USER REQUEST.

Return structured JSON fields: title (max ~60 chars), content (HTML only), excerpt (max 500 characters), meta.description (<=160 chars), meta.keywords (array).`;
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
    content.content = ensureHtmlContent(content.content);
    content.excerpt = clampBlogExcerpt(content.excerpt);
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

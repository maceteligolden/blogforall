import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogGenerationService } from "../services/blog-generation.service";
import {
  InteractivePostGenerationService,
  type PostEnrichment,
  type PostOutline,
  type TopicSuggestion,
} from "../services/interactive-post-generation.service";
import { sendSuccess } from "../../../shared/helper/response.helper";
import { BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { getJwtUserId } from "../../../shared/utils/jwt-user";
import type { z } from "zod";
import type { PromptAnalysis } from "../services/blog-generation.service";
import { assertBlogAiRateLimit } from "../../../shared/utils/blog-ai-rate-limit";
import { TokenEnforcementService } from "../../token-ledger/services/token-enforcement.service";
import { TokenLedgerFeature } from "../../../shared/constants/token-ledger.constant";
import { getRequestIdFromContext, setRequestContextFlow } from "../../../shared/observability/request-context";
import { ObservabilityFlow } from "../../../shared/observability/flows";
import { BlogAiConfig } from "../../../shared/constants/blog-generation.constant";
import type { BlogUserGenerationParams } from "../ai/types";
import {
  blogGenerationAnalyzeBodySchema,
  blogGenerationBodySchema,
  outlineBodySchema,
  suggestTopicsBodySchema,
} from "../validations/blog-route.validation";

type AnalyzeBody = z.infer<typeof blogGenerationAnalyzeBodySchema>;
type GenerateBody = z.infer<typeof blogGenerationBodySchema>;
type SuggestTopicsBody = z.infer<typeof suggestTopicsBodySchema>;
type OutlineBody = z.infer<typeof outlineBodySchema>;

function lengthPresetToWordCount(preset: "short" | "medium" | "long" | undefined): number | undefined {
  if (!preset) return undefined;
  if (preset === "short") return 800;
  if (preset === "medium") return 1500;
  if (preset === "long") return 2500;
  return undefined;
}

function userParamsFromAnalyzeBody(body: AnalyzeBody): BlogUserGenerationParams | undefined {
  const u = body.user_params;
  const wordCount =
    body.word_count ??
    u?.word_count ??
    lengthPresetToWordCount(body.length_preset) ??
    lengthPresetToWordCount(u?.length_preset);
  const merged: BlogUserGenerationParams = {
    tone: body.tone ?? u?.tone,
    target_audience: body.target_audience ?? u?.target_audience,
    topics_to_explore: body.topics_to_explore ?? u?.topics_to_explore,
    word_count: wordCount,
    purpose: body.purpose ?? u?.purpose,
    structure: body.structure ?? u?.structure,
  };
  const hasHints =
    !!merged.tone?.trim() ||
    !!merged.target_audience?.trim() ||
    !!merged.topics_to_explore?.length ||
    merged.word_count != null ||
    !!merged.purpose?.trim() ||
    !!merged.structure?.trim();
  if (!hasHints) return undefined;
  return merged;
}

function userParamsFromGenerateBody(
  body: GenerateBody,
  interactive: InteractivePostGenerationService
): BlogUserGenerationParams | undefined {
  const u = body.user_params;
  const enrichment = body.enrichment as PostEnrichment | undefined;
  const outline = body.approved_outline as PostOutline | undefined;
  const wordCount =
    body.word_count ??
    enrichment?.word_count ??
    u?.word_count ??
    lengthPresetToWordCount(body.length_preset) ??
    lengthPresetToWordCount(enrichment?.length_preset) ??
    lengthPresetToWordCount(u?.length_preset);

  const contextPack = outline ? interactive.buildContextPack(outline, enrichment) : undefined;
  const structureFromOutline = outline ? outline.sections.map((s) => s.heading).join(" → ") : undefined;

  const merged: BlogUserGenerationParams = {
    tone: body.tone ?? enrichment?.tone ?? u?.tone,
    target_audience: body.target_audience ?? enrichment?.target_audience ?? u?.target_audience,
    topics_to_explore: body.topics_to_explore ?? body.keywords ?? outline?.keywords ?? u?.topics_to_explore,
    word_count: wordCount,
    purpose: body.purpose ?? u?.purpose ?? outline?.thesis,
    structure: body.structure ?? u?.structure ?? structureFromOutline,
    context_pack: contextPack,
    post_format: body.post_type ?? outline?.post_type,
    approved_outline_title: outline?.working_title,
    approved_outline_sections: outline?.sections.map((s) => ({
      heading: s.heading,
      summary: s.intent,
    })),
  };
  const hasHints =
    !!merged.tone?.trim() ||
    !!merged.target_audience?.trim() ||
    !!merged.topics_to_explore?.length ||
    merged.word_count != null ||
    !!merged.purpose?.trim() ||
    !!merged.structure?.trim() ||
    !!merged.context_pack?.trim();
  if (!hasHints) return undefined;
  return merged;
}

@injectable()
export class BlogGenerationController {
  constructor(
    private blogGenerationService: BlogGenerationService,
    private interactivePostGeneration: InteractivePostGenerationService,
    private tokenEnforcement: TokenEnforcementService
  ) {}

  suggestTopics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const siteId = String(req.params.siteId || "");
      const body = req.validatedBody as SuggestTopicsBody;
      const result = await this.tokenEnforcement.runWithReservation({
        userId,
        feature: TokenLedgerFeature.BLOG_ANALYZE,
        requestId: getRequestIdFromContext(req),
        estimate: {
          feature: TokenLedgerFeature.BLOG_ANALYZE,
          promptText: body.seed_intent || "suggest topics",
        },
        fn: () =>
          this.interactivePostGeneration.suggestTopics({
            siteId,
            userId,
            seed_intent: body.seed_intent,
            campaign_id: body.campaign_id,
            count: body.count,
          }),
      });
      sendSuccess(res, "Topics suggested successfully", result);
    } catch (error) {
      next(error);
    }
  };

  buildOutline = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const siteId = String(req.params.siteId || "");
      const body = req.validatedBody as OutlineBody;
      const topic = body.topic as TopicSuggestion;
      const outline = await this.tokenEnforcement.runWithReservation({
        userId,
        feature: TokenLedgerFeature.BLOG_ANALYZE,
        requestId: getRequestIdFromContext(req),
        estimate: {
          feature: TokenLedgerFeature.BLOG_ANALYZE,
          promptText: topic.title,
        },
        fn: () =>
          this.interactivePostGeneration.buildOutline({
            siteId,
            userId,
            topic: {
              id: topic.id || `topic_${Date.now()}`,
              title: topic.title,
              about: topic.about,
              campaign_id: topic.campaign_id,
              campaign_name: topic.campaign_name,
              campaign_support: topic.campaign_support,
              keywords: topic.keywords,
              post_type: topic.post_type,
            },
            enrichment: body.enrichment,
          }),
      });
      sendSuccess(res, "Outline built successfully", outline);
    } catch (error) {
      next(error);
    }
  };

  analyzePrompt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const body = req.validatedBody as AnalyzeBody;
      const userParams = userParamsFromAnalyzeBody(body);
      const prompt = body.prompt.trim();
      const analysis = await this.tokenEnforcement.runWithReservation({
        userId,
        feature: TokenLedgerFeature.BLOG_ANALYZE,
        requestId: getRequestIdFromContext(req),
        estimate: {
          feature: TokenLedgerFeature.BLOG_ANALYZE,
          promptText: prompt,
          wordCount: userParams?.word_count,
        },
        fn: () => this.blogGenerationService.analyzePrompt(prompt, userParams),
      });
      sendSuccess(res, "Prompt analyzed successfully", analysis);
    } catch (error) {
      next(error);
    }
  };

  generateBlog = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const body = req.validatedBody as GenerateBody;
      const { prompt, analysis: rawAnalysis } = body;
      const userParams = userParamsFromGenerateBody(body, this.interactivePostGeneration);
      const trimmedPrompt = prompt.trim();

      const full = await this.tokenEnforcement.runWithReservation({
        userId,
        feature: TokenLedgerFeature.BLOG_GENERATE,
        requestId: getRequestIdFromContext(req),
        estimate: {
          feature: TokenLedgerFeature.BLOG_GENERATE,
          promptText: trimmedPrompt,
          wordCount: userParams?.word_count,
        },
        fn: async () => {
          let promptAnalysis = rawAnalysis as PromptAnalysis | undefined;
          if (!promptAnalysis) {
            promptAnalysis = await this.blogGenerationService.analyzePrompt(trimmedPrompt, userParams);
          }
          if (!promptAnalysis.is_valid) {
            throw new BadRequestError(
              promptAnalysis.rejection_reason ||
                "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
            );
          }
          return this.blogGenerationService.generateWithReview(trimmedPrompt, promptAnalysis, userParams);
        },
      });
      logger.info(
        "Post generated with review",
        { title: full.content.title, overallScore: full.review.overall_score },
        "BlogGenerationController"
      );

      sendSuccess(res, "Post content generated successfully", {
        content: full.content,
        analysis: full.analysis,
        review: full.review,
        campaign_id: body.campaign_id ?? body.approved_outline?.campaign_id,
      });
    } catch (error) {
      next(error);
    }
  };

  generateBlogStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const body = req.validatedBody as GenerateBody;
      const { prompt, analysis: rawAnalysis } = body;
      const userParams = userParamsFromGenerateBody(body, this.interactivePostGeneration);
      const trimmedPrompt = prompt.trim();

      await this.tokenEnforcement.runWithReservation({
        userId,
        feature: TokenLedgerFeature.BLOG_GENERATE,
        requestId: getRequestIdFromContext(req),
        estimate: {
          feature: TokenLedgerFeature.BLOG_GENERATE,
          promptText: trimmedPrompt,
          wordCount: userParams?.word_count,
        },
        fn: async () => {
          let promptAnalysis = rawAnalysis as PromptAnalysis | undefined;
          if (!promptAnalysis) {
            promptAnalysis = await this.blogGenerationService.analyzePrompt(trimmedPrompt, userParams);
          }
          if (!promptAnalysis.is_valid) {
            throw new BadRequestError(
              promptAnalysis.rejection_reason ||
                "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
            );
          }

          res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
          res.setHeader("Cache-Control", "no-cache, no-transform");
          res.setHeader("Connection", "keep-alive");
          res.setHeader("X-Accel-Buffering", "no");
          const flush = (res as Response & { flushHeaders?: () => void }).flushHeaders?.bind(res);
          flush?.();

          const ac = new AbortController();
          const onClose = () => ac.abort();
          req.on("close", onClose);
          const streamDeadline = setTimeout(() => ac.abort(), BlogAiConfig.streamDraftTimeoutMs);

          const emit = (event: string, data: unknown) => {
            res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
          };

          try {
            const campaignId = body.campaign_id ?? body.approved_outline?.campaign_id;
            await this.blogGenerationService.streamGenerate(
              trimmedPrompt,
              promptAnalysis!,
              userParams,
              ac.signal,
              (event, data) => {
                if (event === "final" && data && typeof data === "object") {
                  emit(event, { ...(data as Record<string, unknown>), campaign_id: campaignId });
                  return;
                }
                emit(event, data);
              }
            );
            res.end();
          } catch (err) {
            emit("error", { message: (err as Error).message });
            res.end();
          } finally {
            clearTimeout(streamDeadline);
            req.off("close", onClose);
          }
        },
      });
    } catch (error) {
      next(error);
    }
  };
}

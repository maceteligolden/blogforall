import { injectable } from "tsyringe";
import { Request, Response, NextFunction } from "express";
import { BlogGenerationService } from "../services/blog-generation.service";
import {
  InteractivePostGenerationService,
  type PostEnrichment,
  type PostOutline,
  type TopicSuggestion,
} from "../services/interactive-post-generation.service";
import { sendSuccess, sendAccepted } from "../../../shared/helper/response.helper";
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
import { BlogService } from "../services/blog.service";
import { NotificationService } from "../../notification/services/notification.service";
import { RealtimeService, REALTIME_EVENTS } from "../../../shared/realtime";
import { BlogStatus } from "../../../shared/constants";
import { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";
import {
  blogGenerationAnalyzeBodySchema,
  blogGenerationBodySchema,
  outlineBodySchema,
  suggestTopicsBodySchema,
} from "../validations/blog-route.validation";
import { coerceContentArchetype } from "../ai/contracts/content-archetype";
import { resolveStyleProfile } from "../ai/contracts/style-profile";
import { isPostFormat } from "../../orchestrator/ai/contracts/post-format";

type AnalyzeBody = z.infer<typeof blogGenerationAnalyzeBodySchema>;
type GenerateBody = z.infer<typeof blogGenerationBodySchema>;
type SuggestTopicsBody = z.infer<typeof suggestTopicsBodySchema>;
type OutlineBody = z.infer<typeof outlineBodySchema>;

function lengthPresetToWordCount(preset: "short" | "medium" | "long" | "pillar" | undefined): number | undefined {
  if (!preset) return undefined;
  if (preset === "short") return 800;
  if (preset === "medium") return 1500;
  if (preset === "pillar") return 3500;
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

  const content_archetype =
    body.content_archetype ||
    outline?.content_archetype ||
    coerceContentArchetype(body.post_type) ||
    coerceContentArchetype(outline?.post_type) ||
    coerceContentArchetype(body.structure ?? u?.structure);

  // Voice formats only — do NOT stuff interactive post_type into post_format
  const post_format = isPostFormat(body.post_format)
    ? body.post_format
    : isPostFormat(u?.post_format)
      ? u?.post_format
      : undefined;

  const style_profile = resolveStyleProfile({
    archetype: content_archetype,
    structure: body.structure ?? u?.structure,
    purpose: body.purpose ?? u?.purpose ?? outline?.thesis,
    variant: body.style_variant ?? enrichment?.style_variant ?? outline?.style_variant,
    audience: body.target_audience ?? enrichment?.target_audience ?? u?.target_audience,
    tone: body.tone ?? enrichment?.tone ?? u?.tone,
    personal_notes: enrichment?.personal_notes,
    must_include: enrichment?.must_include,
    must_avoid: enrichment?.must_avoid,
    length_preset: body.length_preset ?? enrichment?.length_preset ?? u?.length_preset,
    topic: outline?.working_title ?? body.prompt,
    site_id: undefined,
  });

  const merged: BlogUserGenerationParams = {
    tone: body.tone ?? enrichment?.tone ?? u?.tone,
    target_audience: body.target_audience ?? enrichment?.target_audience ?? u?.target_audience,
    topics_to_explore: body.topics_to_explore ?? body.keywords ?? outline?.keywords ?? u?.topics_to_explore,
    word_count: wordCount,
    purpose: body.purpose ?? u?.purpose ?? outline?.thesis,
    structure: body.structure ?? u?.structure ?? structureFromOutline,
    context_pack: contextPack,
    post_format,
    content_archetype: style_profile.archetype,
    style_variant: style_profile.variant,
    style_profile,
    personal_notes: enrichment?.personal_notes,
    must_include: enrichment?.must_include,
    must_avoid: enrichment?.must_avoid,
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
    !!merged.context_pack?.trim() ||
    !!merged.content_archetype;
  if (!hasHints) return undefined;
  return merged;
}

@injectable()
export class BlogGenerationController {
  constructor(
    private blogGenerationService: BlogGenerationService,
    private interactivePostGeneration: InteractivePostGenerationService,
    private tokenEnforcement: TokenEnforcementService,
    private blogService: BlogService,
    private notificationService: NotificationService,
    private realtimeService: RealtimeService
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
      const siteId = String(req.params.siteId || "");
      const body = req.validatedBody as GenerateBody;
      const { prompt, analysis: rawAnalysis } = body;
      const campaignId = body.campaign_id ?? body.approved_outline?.campaign_id;
      const userParams = await this.interactivePostGeneration.withCampaignConstraints(
        userParamsFromGenerateBody(body, this.interactivePostGeneration),
        siteId,
        campaignId
      );
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
          const generated = await this.blogGenerationService.generateWithReview(
            trimmedPrompt,
            promptAnalysis,
            userParams
          );
          await this.interactivePostGeneration.assertDraftAlignsWithCampaign({
            siteId,
            campaignId,
            title: generated.content.title,
            content: generated.content.content,
          });
          return generated;
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
        campaign_id: campaignId,
      });
    } catch (error) {
      next(error);
    }
  };

  generateBlogBackground = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const siteId = String(req.params.siteId || "");
      const body = req.validatedBody as GenerateBody;
      const campaignId = body.campaign_id ?? body.approved_outline?.campaign_id;
      const title = (body.approved_outline?.working_title || body.prompt).slice(0, 200).trim() || "Untitled draft";
      const blog = await this.blogService.createBlog(userId, siteId, {
        title,
        content: "<p>This draft is being written. It will be ready to edit shortly.</p>",
        status: BlogStatus.GENERATING,
        campaign_id: campaignId,
      });
      const blogId = String(blog._id);
      sendAccepted(res, "Draft generation started", { blog_id: blogId });

      const requestId = getRequestIdFromContext(req);
      const trimmedPrompt = body.prompt.trim();
      void this.runBackgroundGeneration({
        userId,
        siteId,
        blogId,
        body,
        campaignId,
        trimmedPrompt,
        requestId,
      });
    } catch (error) {
      next(error);
    }
  };

  private async runBackgroundGeneration(input: {
    userId: string;
    siteId: string;
    blogId: string;
    body: GenerateBody;
    campaignId?: string;
    trimmedPrompt: string;
    requestId?: string;
  }): Promise<void> {
    try {
      const userParams = await this.interactivePostGeneration.withCampaignConstraints(
        userParamsFromGenerateBody(input.body, this.interactivePostGeneration),
        input.siteId,
        input.campaignId
      );
      const full = await this.tokenEnforcement.runWithReservation({
        userId: input.userId,
        feature: TokenLedgerFeature.BLOG_GENERATE,
        requestId: input.requestId ?? `bg-generate:${input.blogId}`,
        estimate: {
          feature: TokenLedgerFeature.BLOG_GENERATE,
          promptText: input.trimmedPrompt,
          wordCount: userParams?.word_count,
        },
        fn: async () => {
          let promptAnalysis = input.body.analysis as PromptAnalysis | undefined;
          if (!promptAnalysis) {
            promptAnalysis = await this.blogGenerationService.analyzePrompt(input.trimmedPrompt, userParams);
          }
          if (!promptAnalysis.is_valid) {
            throw new BadRequestError(
              promptAnalysis.rejection_reason ||
                "We couldn't understand your prompt. Please provide a clear topic or question about what you'd like to write about."
            );
          }
          const generated = await this.blogGenerationService.generateWithReview(
            input.trimmedPrompt,
            promptAnalysis,
            userParams
          );
          await this.interactivePostGeneration.assertDraftAlignsWithCampaign({
            siteId: input.siteId,
            campaignId: input.campaignId,
            title: generated.content.title,
            content: generated.content.content,
          });
          return generated;
        },
      });

      await this.blogService.updateBlog(input.blogId, input.siteId, input.userId, {
        title: full.content.title,
        content: full.content.content,
        excerpt: full.content.excerpt,
        meta: full.content.meta
          ? {
              description: full.content.meta.description ?? undefined,
              keywords: full.content.meta.keywords ?? undefined,
            }
          : undefined,
        status: BlogStatus.DRAFT,
      });

      this.realtimeService.emitToUser(
        input.userId,
        REALTIME_EVENTS.BLOG_STATUS_CHANGED,
        { blogId: input.blogId, siteId: input.siteId, status: BlogStatus.DRAFT },
        { siteId: input.siteId }
      );

      await this.notificationService.createAndSend({
        channel: NotificationChannel.IN_APP,
        type: NotificationType.BLOG_DRAFT_READY,
        recipientUserId: input.userId,
        title: "Draft ready — open to edit",
        body: `"${full.content.title}" is ready. Open it to review and edit.`,
        payload: { blog_id: input.blogId, site_id: input.siteId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        "Background blog generation failed",
        error instanceof Error ? error : new Error(message),
        { blogId: input.blogId, siteId: input.siteId },
        "BlogGenerationController"
      );
      try {
        await this.blogService.updateBlog(input.blogId, input.siteId, input.userId, {
          content: `<p>Draft generation failed: ${message}</p>`,
          status: BlogStatus.DRAFT,
        });
      } catch {
        /* ignore follow-up write errors */
      }
      this.realtimeService.emitToUser(
        input.userId,
        REALTIME_EVENTS.BLOG_STATUS_CHANGED,
        { blogId: input.blogId, siteId: input.siteId, status: BlogStatus.DRAFT, error: message },
        { siteId: input.siteId }
      );
      try {
        await this.notificationService.createAndSend({
          channel: NotificationChannel.IN_APP,
          type: NotificationType.BLOG_DRAFT_READY,
          recipientUserId: input.userId,
          title: "Draft generation failed",
          body: message,
          payload: { blog_id: input.blogId, site_id: input.siteId },
        });
      } catch {
        /* ignore */
      }
    }
  }

  generateBlogStream = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      setRequestContextFlow(ObservabilityFlow.BLOG_GENERATION);
      const userId = getJwtUserId(req);
      assertBlogAiRateLimit(userId);
      const siteId = String(req.params.siteId || "");
      const body = req.validatedBody as GenerateBody;
      const { prompt, analysis: rawAnalysis } = body;
      const campaignId = body.campaign_id ?? body.approved_outline?.campaign_id;
      const userParams = await this.interactivePostGeneration.withCampaignConstraints(
        userParamsFromGenerateBody(body, this.interactivePostGeneration),
        siteId,
        campaignId
      );
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
            const generated = await this.blogGenerationService.streamGenerate(
              trimmedPrompt,
              promptAnalysis!,
              userParams,
              ac.signal,
              (event, data) => {
                if (event === "final") return;
                emit(event, data);
              }
            );
            await this.interactivePostGeneration.assertDraftAlignsWithCampaign({
              siteId,
              campaignId,
              title: generated.content.title,
              content: generated.content.content,
            });
            emit("final", { ...generated, campaign_id: campaignId });
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

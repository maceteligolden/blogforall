import { tool } from "langchain";
import { z } from "zod";
import { container } from "tsyringe";
import { CampaignRepository } from "../campaign/repositories/campaign.repository";
import { CampaignPostItemRepository } from "../campaign/repositories/campaign-post-item.repository";
import { BlogService } from "../blog/services/blog.service";
import { BlogGenerationService } from "../blog/services/blog-generation.service";
import type { PromptAnalysis, ResearchNote } from "../blog/ai/types";
import { InteractivePostGenerationService } from "../blog/services/interactive-post-generation.service";
import { OrchestratorThreadRepository } from "../orchestrator/repositories/orchestrator-thread.repository";
import { NotificationService } from "../notification/services/notification.service";
import { RealtimeService, REALTIME_EVENTS } from "../../shared/realtime";
import { BlogStatus } from "../../shared/constants";
import { CampaignPostItemStatus } from "../../shared/constants/campaign.constant";
import {
  NotificationChannel,
  NotificationType,
} from "../../shared/constants/notification.constant";
import type { OrchestratorThread } from "../../shared/schemas/orchestrator-thread.schema";
import { logger } from "../../shared/utils/logger";
import { ResearchGraphService } from "./research/research-graph.service";
import { ArtifactStoreService } from "../orchestrator/ai/memory/artifact-store.service";
import { researchPackageToNotes } from "../orchestrator/ai/skills/writing/package-to-notes";

export type WritingToolContext = {
  siteId: string;
  userId: string;
  threadId?: string;
};

export type NextDueTopic = {
  campaign_id: string;
  campaign_name: string;
  sequence_index: number;
  title: string;
  objective: string;
  strategic_intent: string;
  scheduled_at?: string;
  overdue: boolean;
};

const SKIP_STATUSES = new Set<string>([
  CampaignPostItemStatus.DRAFTING,
  CampaignPostItemStatus.DRAFT_READY,
  CampaignPostItemStatus.PUBLISHED,
  CampaignPostItemStatus.SKIPPED,
  CampaignPostItemStatus.CANCELLED,
  CampaignPostItemStatus.AWAITING_APPROVAL,
]);

function toolResult(summary: string, data: Record<string, unknown> = {}): string {
  return JSON.stringify({ summary, ...data });
}

function emitResearchPhase(
  realtime: RealtimeService,
  ctx: WritingToolContext,
  event: { phase: string; message: string; percent?: number },
) {
  if (!ctx.threadId) return;
  realtime.emitToUser(
    ctx.userId,
    REALTIME_EVENTS.ORCHESTRATOR_PHASE,
    {
      threadId: ctx.threadId,
      siteId: ctx.siteId,
      phase: event.phase,
      message: event.message,
      percent: event.percent,
      skill_id: "research",
    },
    { siteId: ctx.siteId },
  );
}

function buildWritingResearchQuestion(args: {
  topic: string;
  intent?: string;
  angle?: unknown;
  mustInclude?: unknown;
  mustAvoid?: unknown;
  cta?: unknown;
  audienceNotes?: unknown;
  personalNotes?: unknown;
  campaignGoal?: string;
}): string {
  const lines = [`Write-ready research for a blog post: ${args.topic}`];
  if (args.intent) lines.push(`Strategic intent: ${args.intent}`);
  if (typeof args.angle === "string" && args.angle.trim()) {
    lines.push(`Angle: ${args.angle.trim()}`);
  }
  if (typeof args.audienceNotes === "string" && args.audienceNotes.trim()) {
    lines.push(`Audience: ${args.audienceNotes.trim()}`);
  }
  if (typeof args.mustInclude === "string" && args.mustInclude.trim()) {
    lines.push(`Must include: ${args.mustInclude.trim()}`);
  }
  if (typeof args.mustAvoid === "string" && args.mustAvoid.trim()) {
    lines.push(`Must avoid: ${args.mustAvoid.trim()}`);
  }
  if (typeof args.cta === "string" && args.cta.trim()) {
    lines.push(`CTA: ${args.cta.trim()}`);
  }
  if (typeof args.personalNotes === "string" && args.personalNotes.trim()) {
    lines.push(`Notes from the author: ${args.personalNotes.trim()}`);
  }
  if (args.campaignGoal) lines.push(`Campaign goal: ${args.campaignGoal}`);
  return lines.join("\n").slice(0, 2000);
}

function truncate(text: string, max = 180): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

export async function listNextDueTopics(siteId: string, limit = 4): Promise<NextDueTopic[]> {
  const campaigns = container.resolve(CampaignRepository);
  const items = container.resolve(CampaignPostItemRepository);
  const page = await campaigns.findAll(siteId, { limit: 20, page: 1 });
  const now = Date.now();
  const collected: NextDueTopic[] = [];

  for (const campaign of page.data) {
    const campaignId = campaign._id!.toString();
    const posts = await items.findByCampaign(campaignId, siteId);
    for (const post of posts) {
      if (post.blog_id) continue;
      if (SKIP_STATUSES.has(post.status) && post.status !== CampaignPostItemStatus.DRAFTING) continue;
      const scheduledAt = post.scheduled_at ? new Date(post.scheduled_at) : undefined;
      collected.push({
        campaign_id: campaignId,
        campaign_name: campaign.name,
        sequence_index: post.sequence_index,
        title: post.title,
        objective: post.objective,
        strategic_intent: post.strategic_intent,
        scheduled_at: scheduledAt?.toISOString(),
        overdue: Boolean(scheduledAt && scheduledAt.getTime() < now),
      });
    }
  }

  collected.sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
    const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : Number.MAX_SAFE_INTEGER;
    if (aTime !== bTime) return aTime - bTime;
    return a.sequence_index - b.sequence_index;
  });

  return collected.slice(0, limit);
}

export async function followUpAfterDraftStarted(siteId: string, justStartedTopic: string): Promise<string> {
  const head = `Drafting "${justStartedTopic}" in the background. I'll notify you when it's ready to edit.`;
  try {
    const topics = await listNextDueTopics(siteId, 4);
    const next = topics.find((topic) => topic.title !== justStartedTopic);
    if (next) {
      const when = next.overdue
        ? "overdue"
        : next.scheduled_at
          ? `due ${next.scheduled_at.slice(0, 10)}`
          : "up next";
      return `${head}\n\nNext on ${next.campaign_name}: "${next.title}" (${when}). Want to start that, or talk through how the campaign is tracking?`;
    }
  } catch {
    // Fall through to the no-next-topic close.
  }
  return `${head}\n\nNothing else is waiting on the roadmap. Want to look at campaign progress, or pick another topic?`;
}

function formatFieldLines(args: Record<string, unknown>, keys: string[]): string[] {
  const lines: string[] = [];
  for (const key of keys) {
    const value = args[key];
    if (value == null || value === "") continue;
    lines.push(`- ${key}: ${Array.isArray(value) ? value.map(String).join("; ") : String(value)}`);
  }
  return lines;
}

export function formatWritingResearchDraft(args: Record<string, unknown>): string {
  return ["Ready to research this post:", ...formatFieldLines(args, [
    "topic",
    "intent",
    "campaign_name",
    "angle",
    "must_include",
    "must_avoid",
    "cta",
    "audience_notes",
  ])].join("\n");
}

export function formatWritingConfirmResearchDraft(args: Record<string, unknown>): string {
  return [
    "Approve this research to start the background draft?",
    ...formatFieldLines(args, ["topic", "intent", "research_summary", "campaign_name"]),
  ].join("\n");
}

function coerceSequence(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && /^-?\d+$/.test(value.trim())) return Number(value.trim());
  return undefined;
}

function topicsMatch(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function resolveFocus(thread: OrchestratorThread | null, args: Record<string, unknown>) {
  const focus = thread?.focus ?? {};
  const campaignId =
    (typeof args.campaign_id === "string" && args.campaign_id) || focus.campaign_id || "";
  const sequence =
    coerceSequence(args.sequence_index) ?? coerceSequence(focus.roadmap_sequence_index);
  const topic = (typeof args.topic === "string" && args.topic) || focus.topic || "";
  const intent = (typeof args.intent === "string" && args.intent) || focus.intent || "";
  const argBlogId = typeof args.blog_id === "string" && args.blog_id ? args.blog_id : "";
  const argTopic = typeof args.topic === "string" && args.topic ? args.topic : "";
  const focusTopic = typeof focus.topic === "string" ? focus.topic : "";
  const topicChanged = Boolean(argTopic && focusTopic && !topicsMatch(argTopic, focusTopic));
  const blogId = argBlogId || (topicChanged ? "" : focus.blog_id || "");
  return { campaignId, sequence, topic, intent, blogId, focus };
}

async function bindRoadmapDraft(input: {
  siteId: string;
  campaignId?: string;
  sequence?: number;
  topic?: string;
  blogId: string;
  status: CampaignPostItemStatus;
}): Promise<void> {
  if (!input.campaignId) return;
  const items = container.resolve(CampaignPostItemRepository);
  let item =
    input.sequence != null
      ? await items.findBySequence(input.campaignId, input.siteId, input.sequence)
      : null;
  if (!item) {
    const all = await items.findByCampaign(input.campaignId, input.siteId);
    item =
      all.find((row) => row.blog_id === input.blogId) ||
      all.find((row) => input.topic && row.title === input.topic && !row.blog_id) ||
      all.find((row) => input.sequence != null && row.sequence_index === input.sequence) ||
      null;
  }
  if (!item?._id) return;
  await items.update(item._id.toString(), input.siteId, {
    status: input.status,
    blog_id: input.blogId,
  });
}

function buildDraftPrompt(input: {
  topic: string;
  intent: string;
  angle?: string;
  mustInclude?: string;
  mustAvoid?: string;
  cta?: string;
  audienceNotes?: string;
  personalNotes?: string;
}): string {
  return [
    `Write a blog post on: ${input.topic}`,
    input.intent ? `Strategic intent: ${input.intent}` : "",
    input.angle ? `Angle: ${input.angle}` : "",
    input.audienceNotes ? `Audience notes: ${input.audienceNotes}` : "",
    input.mustInclude ? `Must include: ${input.mustInclude}` : "",
    input.mustAvoid ? `Must avoid: ${input.mustAvoid}` : "",
    input.cta ? `CTA: ${input.cta}` : "",
    input.personalNotes ? `From the conversation: ${input.personalNotes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function fallbackAnalysis(topic: string, intent?: string): PromptAnalysis {
  return {
    topic,
    domain: "general",
    target_audience: "",
    purpose: intent || "educate the reader",
    is_valid: true,
    word_count: 1200,
    tone: "professional",
    topics_to_explore: [topic],
  };
}

async function loadResearchNotesForDraft(
  siteId: string,
  args: Record<string, unknown>,
): Promise<ResearchNote[]> {
  const notes: ResearchNote[] = [];
  const packageId = stringArg(args, "package_id");
  if (packageId) {
    try {
      const artifacts = container.resolve(ArtifactStoreService);
      const pkg = await artifacts.getResearchPackage(siteId, packageId);
      if (pkg) {
        const mapped = researchPackageToNotes(pkg);
        const report = pkg.report_markdown?.trim() || stringArg(args, "research_summary");
        if (report) {
          notes.push({
            url: `research://${packageId}`,
            title: "Approved research report",
            snippet: report.slice(0, 8000),
          });
        }
        notes.push(...mapped);
      }
    } catch (error) {
      logger.warn(
        "Could not load research package for background draft",
        {
          siteId,
          packageId,
          error: error instanceof Error ? error.message : String(error),
        },
        "WritingTools",
      );
    }
  }
  if (notes.length === 0) {
    const summary = stringArg(args, "research_summary");
    if (summary) {
      notes.push({
        url: "research://approved",
        title: "Approved research",
        snippet: summary.slice(0, 8000),
      });
    }
  }
  return notes;
}

function stringArg(args: Record<string, unknown>, key: string): string | undefined {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

export async function startBoundWritingDraft(
  ctx: WritingToolContext,
  args: Record<string, unknown>,
): Promise<{ blogId: string; topic: string; campaignId?: string }> {
  const threads = container.resolve(OrchestratorThreadRepository);
  const blogService = container.resolve(BlogService);
  const generation = container.resolve(BlogGenerationService);
  const interactive = container.resolve(InteractivePostGenerationService);
  const realtime = container.resolve(RealtimeService);
  const notifications = container.resolve(NotificationService);

  const thread = ctx.threadId ? await threads.findById(ctx.threadId, ctx.siteId) : null;
  const resolved = resolveFocus(thread, args);
  const topic = resolved.topic || "Untitled post";
  const intent = resolved.intent;

  const prompt = buildDraftPrompt({
    topic,
    intent,
    angle: stringArg(args, "angle"),
    mustInclude: stringArg(args, "must_include"),
    mustAvoid: stringArg(args, "must_avoid"),
    cta: stringArg(args, "cta"),
    audienceNotes: stringArg(args, "audience_notes"),
    personalNotes: stringArg(args, "personal_notes"),
  });

  const campaignId = resolved.campaignId || undefined;
  const blog = await blogService.createBlog(ctx.userId, ctx.siteId, {
    title: topic.slice(0, 200),
    content: "<p>This draft is being written. It will be ready to edit shortly.</p>",
    status: BlogStatus.GENERATING,
    campaign_id: campaignId,
  });
  const blogId = String(blog._id);

  await bindRoadmapDraft({
    siteId: ctx.siteId,
    campaignId,
    sequence: resolved.sequence,
    topic,
    blogId,
    status: CampaignPostItemStatus.DRAFTING,
  });

  if (ctx.threadId) {
    const nextTopics = await listNextDueTopics(ctx.siteId, 4).catch(() => [] as NextDueTopic[]);
    const next = nextTopics.find((row) => row.title !== topic);
    if (next) {
      await threads.setFocus(ctx.threadId, ctx.siteId, {
        campaign_id: next.campaign_id,
        roadmap_sequence_index: next.sequence_index,
        topic: next.title,
        intent: next.strategic_intent,
      });
    } else {
      await threads.setFocus(ctx.threadId, ctx.siteId, {
        campaign_id: campaignId,
        roadmap_sequence_index: resolved.sequence,
        topic,
        intent,
      });
    }
  }

  realtime.emitToUser(
    ctx.userId,
    REALTIME_EVENTS.BLOG_STATUS_CHANGED,
    { blogId, siteId: ctx.siteId, status: BlogStatus.GENERATING },
    { siteId: ctx.siteId }
  );

  void (async () => {
    try {
      logger.info("Writing background draft started", { blogId, siteId: ctx.siteId, topic }, "WritingTools");
      const researchNotes = await loadResearchNotesForDraft(ctx.siteId, args);
      const userParams = await interactive.withCampaignConstraints(
        {
          site_id: ctx.siteId,
          personal_notes: stringArg(args, "personal_notes"),
          must_include: stringArg(args, "must_include"),
          must_avoid: stringArg(args, "must_avoid"),
          target_audience: stringArg(args, "audience_notes"),
          purpose: intent,
          topics_to_explore: [topic],
        },
        ctx.siteId,
        campaignId
      );
      let analysis: PromptAnalysis;
      try {
        analysis = await generation.analyzePrompt(prompt, userParams);
      } catch (analyzeError) {
        logger.warn(
          "Prompt analysis failed; using topic fallback",
          {
            blogId,
            reason: analyzeError instanceof Error ? analyzeError.message : String(analyzeError),
          },
          "WritingTools",
        );
        analysis = fallbackAnalysis(topic, intent);
      }
      if (!analysis.is_valid) {
        analysis = fallbackAnalysis(topic, intent);
      }
      const generated = await generation.generateWithReviewFromNotes(
        prompt,
        analysis,
        researchNotes,
        userParams
      );
      try {
        await interactive.assertDraftAlignsWithCampaign({
          siteId: ctx.siteId,
          campaignId,
          title: generated.content.title,
          content: generated.content.content,
        });
      } catch (alignError) {
        logger.warn(
          "Writing draft alignment check failed; keeping generated draft",
          {
            blogId,
            siteId: ctx.siteId,
            reason: alignError instanceof Error ? alignError.message : String(alignError),
          },
          "WritingTools"
        );
      }
      await blogService.updateBlog(blogId, ctx.siteId, ctx.userId, {
        title: generated.content.title,
        content: generated.content.content,
        excerpt: generated.content.excerpt,
        status: BlogStatus.DRAFT,
      });
      await bindRoadmapDraft({
        siteId: ctx.siteId,
        campaignId,
        sequence: resolved.sequence,
        topic,
        blogId,
        status: CampaignPostItemStatus.DRAFT_READY,
      });
      realtime.emitToUser(
        ctx.userId,
        REALTIME_EVENTS.BLOG_STATUS_CHANGED,
        { blogId, siteId: ctx.siteId, status: BlogStatus.DRAFT },
        { siteId: ctx.siteId }
      );
      await notifications.createAndSend({
        channel: NotificationChannel.IN_APP,
        type: NotificationType.BLOG_DRAFT_READY,
        recipientUserId: ctx.userId,
        title: "Draft ready — open to edit",
        body: `"${generated.content.title}" is ready. Open it to review and edit.`,
        payload: { blog_id: blogId, site_id: ctx.siteId },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error(
        "Writing skill background draft failed",
        error instanceof Error ? error : new Error(message),
        { blogId, siteId: ctx.siteId },
        "WritingTools"
      );
      realtime.emitToUser(
        ctx.userId,
        REALTIME_EVENTS.BLOG_STATUS_CHANGED,
        {
          blogId,
          siteId: ctx.siteId,
          status: BlogStatus.GENERATING,
          error: message,
        },
        { siteId: ctx.siteId }
      );
      try {
        await notifications.createAndSend({
          channel: NotificationChannel.IN_APP,
          type: NotificationType.BLOG_DRAFT_READY,
          recipientUserId: ctx.userId,
          title: "Draft generation failed",
          body: `"${topic}" is still generating. ${message}`,
          payload: { blog_id: blogId, site_id: ctx.siteId },
        });
      } catch {
        /* ignore */
      }
    }
  })();

  return { blogId, topic, campaignId };
}

export function createWritingTools(ctx: WritingToolContext) {
  const writing_next_due = tool(
    async () => {
      const topics = await listNextDueTopics(ctx.siteId, 6);
      if (!topics.length) {
        return toolResult("No undrafted roadmap topics right now. Use Evergreen or discuss a new post.", {
          topics: [],
        });
      }
      const lines = topics.map((t) => {
        const when = t.overdue ? "overdue" : t.scheduled_at ? `due ${t.scheduled_at.slice(0, 10)}` : "unscheduled";
        return `- ${t.title} (${t.campaign_name}, ${when})`;
      });
      return toolResult(`Next undrafted topics:\n${lines.join("\n")}`, { topics });
    },
    {
      name: "writing_next_due",
      description:
        "List undrafted campaign roadmap topics, overdue first then soonest scheduled. Use when the user has not named a post, or to suggest what to write next.",
      schema: z.object({}),
    }
  );

  const writing_request_research = tool(
    async (args) => {
      const threads = container.resolve(OrchestratorThreadRepository);
      const campaigns = container.resolve(CampaignRepository);
      const research = container.resolve(ResearchGraphService);
      const realtime = container.resolve(RealtimeService);
      const thread = ctx.threadId ? await threads.findById(ctx.threadId, ctx.siteId) : null;
      const resolved = resolveFocus(thread, args);
      const topic = resolved.topic || "this topic";
      if (ctx.threadId) {
        await threads.setFocus(ctx.threadId, ctx.siteId, {
          campaign_id: resolved.campaignId || resolved.focus.campaign_id,
          roadmap_sequence_index: resolved.sequence ?? resolved.focus.roadmap_sequence_index,
          topic: resolved.topic || resolved.focus.topic,
          intent: resolved.intent || resolved.focus.intent,
        });
      }

      let campaignGoal = "";
      if (resolved.campaignId) {
        try {
          const campaign = await campaigns.findById(resolved.campaignId, ctx.siteId);
          campaignGoal = campaign?.goal?.trim() || "";
        } catch {
          campaignGoal = "";
        }
      }

      const question = buildWritingResearchQuestion({
        topic,
        intent: resolved.intent,
        angle: args.angle,
        mustInclude: args.must_include,
        mustAvoid: args.must_avoid,
        cta: args.cta,
        audienceNotes: args.audience_notes,
        personalNotes: args.personal_notes,
        campaignGoal,
      });

      try {
        const result = await research.run({
          workspace_id: ctx.siteId,
          question,
          depth: "full",
          purpose: "post",
          persist: true,
          created_by: ctx.userId,
          thread_id: ctx.threadId,
          onPhase: (event) => emitResearchPhase(realtime, ctx, event),
        });
        return toolResult(
          `Research complete for "${topic}". Your user-facing reply MUST be report_markdown as Markdown — not "done" and not a one-line summary. Do not call writing_confirm_research in this turn; the UI will ask the user to continue after the report.`,
          {
            topic: resolved.topic,
            intent: resolved.intent,
            campaign_id: resolved.campaignId,
            sequence_index: resolved.sequence,
            package_id: result.package_id,
            report_markdown: result.report_markdown,
            spoken_summary: result.spoken_summary,
            findings: result.findings.map((f) => ({
              title: f.title,
              finding: f.finding,
              confidence: f.confidence,
              implication: f.implication,
            })),
            summary: result.summary,
            degraded: result.degraded,
            brief: {
              angle: args.angle,
              must_include: args.must_include,
              must_avoid: args.must_avoid,
              cta: args.cta,
              audience_notes: args.audience_notes,
              personal_notes: args.personal_notes,
            },
          },
        );
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error(
          "Writing research run failed after HITL approval",
          err,
          { siteId: ctx.siteId, threadId: ctx.threadId, topic },
          "WritingTools",
        );
        return toolResult(
          `Research failed for "${topic}": ${err.message}. Stay in discussion and ask whether to retry writing_request_research.`,
          {
            topic: resolved.topic,
            intent: resolved.intent,
            campaign_id: resolved.campaignId,
            sequence_index: resolved.sequence,
            error: err.message,
          },
        );
      }
    },
    {
      name: "writing_request_research",
      description:
        "Ask the user to approve starting research for the bound topic. After they approve, this tool runs full research and returns the report. Do not call writing_confirm_research in this turn. HITL-gated.",
      schema: z.object({
        topic: z.string().min(1).max(400),
        intent: z.string().max(2000).optional(),
        campaign_id: z.string().optional(),
        campaign_name: z.string().optional(),
        sequence_index: z.number().int().min(0).optional(),
        angle: z.string().max(1000).optional(),
        must_include: z.string().max(2000).optional(),
        must_avoid: z.string().max(2000).optional(),
        cta: z.string().max(400).optional(),
        audience_notes: z.string().max(1000).optional(),
        personal_notes: z.string().max(4000).optional(),
      }),
    }
  );

  const writing_confirm_research = tool(
    async (args) => {
      const started = await startBoundWritingDraft(ctx, args as Record<string, unknown>);
      const followUp = await followUpAfterDraftStarted(ctx.siteId, started.topic);
      return toolResult(followUp, {
        blog_id: started.blogId,
        campaign_id: started.campaignId,
        topic: started.topic,
      });
    },
    {
      name: "writing_confirm_research",
      description:
        "Ask the user to approve the research report, then start a background draft (review + rewrite before showing). HITL-gated. Pass the writing brief captured from chat.",
      schema: z.object({
        topic: z.string().min(1).max(400),
        intent: z.string().max(2000).optional(),
        campaign_id: z.string().optional(),
        campaign_name: z.string().optional(),
        sequence_index: z.number().int().min(0).optional(),
        research_summary: z.string().max(4000).optional(),
        angle: z.string().max(1000).optional(),
        must_include: z.string().max(2000).optional(),
        must_avoid: z.string().max(2000).optional(),
        cta: z.string().max(400).optional(),
        audience_notes: z.string().max(1000).optional(),
        personal_notes: z.string().max(4000).optional(),
      }),
    }
  );

  const writing_revise_draft = tool(
    async (args) => {
      const threads = container.resolve(OrchestratorThreadRepository);
      const blogService = container.resolve(BlogService);
      const generation = container.resolve(BlogGenerationService);
      const interactive = container.resolve(InteractivePostGenerationService);
      const thread = ctx.threadId ? await threads.findById(ctx.threadId, ctx.siteId) : null;
      const blogId = args.blog_id || thread?.focus?.blog_id;
      if (!blogId) {
        return toolResult("No draft is bound to this thread. Open a post or name which draft to edit.");
      }
      const existing = await blogService.getBlogById(blogId, ctx.siteId, ctx.userId);
      const userParams = await interactive.withCampaignConstraints(
        { site_id: ctx.siteId },
        ctx.siteId,
        existing.campaign_id
      );
      const revised = await generation.regenerateWithFeedback({
        title: existing.title,
        content: existing.content,
        excerpt: existing.excerpt,
        feedback: args.instruction,
        userParams,
      });
      const updated = await blogService.updateBlog(blogId, ctx.siteId, ctx.userId, {
        title: revised.title,
        content: revised.content,
        excerpt: revised.excerpt,
      });
      const realtime = container.resolve(RealtimeService);
      realtime.emitToUser(
        ctx.userId,
        REALTIME_EVENTS.BLOG_STATUS_CHANGED,
        { blogId, siteId: ctx.siteId, status: updated.status },
        { siteId: ctx.siteId }
      );
      return toolResult(`Updated the full draft from your instruction: ${truncate(args.instruction)}`, {
        blog_id: blogId,
        title: updated.title,
        content: updated.content,
        excerpt: updated.excerpt,
        content_blocks: updated.content_blocks,
        updated_at: updated.updated_at,
      });
    },
    {
      name: "writing_revise_draft",
      description:
        "Revise the bound blog draft from a natural-language instruction. Always persist the COMPLETE updated post (not a section fragment). Use when the user is editing an existing draft.",
      schema: z.object({
        instruction: z.string().min(1).max(4000),
        blog_id: z.string().optional(),
      }),
    }
  );

  return [writing_next_due, writing_request_research, writing_confirm_research, writing_revise_draft];
}

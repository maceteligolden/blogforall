import { tool } from "langchain";
import { z } from "zod";
import { container } from "tsyringe";
import { CampaignRepository } from "../campaign/repositories/campaign.repository";
import { CampaignService } from "../campaign/services/campaign.service";
import { CampaignPlanningService } from "../campaign/services/campaign-planning.service";
import { CampaignRoadmapService } from "../campaign/services/campaign-roadmap.service";
import { CampaignProgressReportService } from "../campaign/services/campaign-progress-report.service";
import { CampaignHealthService } from "../campaign/services/campaign-health.service";
import { ScheduledPostRepository } from "../campaign/repositories/scheduled-post.repository";
import { ScheduledPostService } from "../campaign/services/scheduled-post.service";
import { PostFrequency, ScheduledPostStatus } from "../../shared/constants/campaign.constant";
import type { Campaign } from "../../shared/schemas/campaign.schema";
import { resolveCampaignIdForTool } from "../orchestrator/ai/tools/_helpers";

export type CampaignToolContext = {
  siteId: string;
  userId: string;
  threadId?: string;
};

const frequencySchema = z.enum(["daily", "weekly", "biweekly", "monthly", "custom"]);

const createCampaignSchema = z.object({
  name: z.string().min(1).max(200),
  goal: z.string().min(1).max(2000),
  target_audience: z.string().max(1000).optional(),
  description: z.string().max(4000).optional(),
  start_date: z.string().describe("ISO date YYYY-MM-DD"),
  end_date: z.string().describe("ISO date YYYY-MM-DD"),
  posting_frequency: frequencySchema.optional(),
  timezone: z.string().optional(),
  total_posts_planned: z.number().int().positive().optional(),
  primary_topics: z.array(z.string().min(1).max(200)).max(20).optional(),
});

const updateCampaignSchema = z.object({
  campaign_id: z.string().optional(),
  name: z.string().min(1).max(200).optional(),
  goal: z.string().min(1).max(2000).optional(),
  target_audience: z.string().max(1000).optional(),
  description: z.string().max(4000).optional(),
  start_date: z.string().describe("ISO date YYYY-MM-DD").optional(),
  end_date: z.string().describe("ISO date YYYY-MM-DD").optional(),
  posting_frequency: frequencySchema.optional(),
  timezone: z.string().optional(),
  total_posts_planned: z.number().int().positive().optional(),
});

const campaignLookupSchema = z.object({
  campaign_id: z.string().optional(),
  name: z.string().optional(),
  goal: z.string().optional(),
});

const progressSchema = campaignLookupSchema.extend({
  date: z.string().optional(),
});

const scheduleAdditionalSchema = z.object({
  campaign_id: z.string().optional(),
  name: z.string().optional(),
  count: z.number().int().min(1).max(10).optional(),
  interval_days: z.number().int().min(1).max(90).optional(),
  anchor_scheduled_post_id: z.string().optional(),
  topic_hint: z.string().max(500).optional(),
});

function truncate(text: string, max = 160): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function parseDate(value: string, bound: "start" | "end" = "start"): Date {
  const trimmed = value.trim();
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (dateOnly) {
    if (bound === "end") {
      return new Date(`${trimmed}T23:59:59.999Z`);
    }
    const start = new Date(`${trimmed}T00:00:00.000Z`);
    const now = new Date();
    return start < now ? now : start;
  }
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Invalid date: ${value}`);
  }
  return d;
}

function isoDate(value: Date | string | undefined): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function campaignEntityFields(campaign: Campaign): Record<string, unknown> {
  const campaignId = campaign._id!.toString();
  return {
    id: campaignId,
    campaign_id: campaignId,
    name: campaign.name,
    goal: campaign.goal,
    target_audience: campaign.target_audience,
    description: campaign.description,
    start_date: isoDate(campaign.start_date),
    end_date: isoDate(campaign.end_date),
    posting_frequency: campaign.posting_frequency,
    timezone: campaign.timezone,
    lifecycle_status: campaign.lifecycle_status,
    status: campaign.status,
    health_status: campaign.health_status,
    messaging: campaign.messaging,
    funnel_focus: campaign.funnel_focus,
    primary_topics: campaign.primary_topics,
    success_metrics: campaign.success_metrics,
    total_posts_planned: campaign.total_posts_planned,
  };
}

function toolResult(summary: string, data: Record<string, unknown> = {}): string {
  return JSON.stringify({ summary, ...data });
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

export function formatCampaignCreateDraft(args: Record<string, unknown>): string {
  const lines = ["Proposed new campaign:"];
  const fields = formatFieldLines(args, [
    "name",
    "goal",
    "target_audience",
    "description",
    "start_date",
    "end_date",
    "posting_frequency",
    "timezone",
    "total_posts_planned",
    "primary_topics",
  ]);
  lines.push(...(fields.length ? fields : ["- (no field values detected)"]));
  lines.push("", "Approve to create, or reject to keep discussing.");
  return lines.join("\n");
}

export function formatCampaignUpdateDraft(args: Record<string, unknown>): string {
  const lines = ["Proposed campaign update:"];
  if (typeof args.campaign_id === "string" && args.campaign_id.trim()) {
    lines.push(`- campaign_id: ${args.campaign_id.trim()}`);
  }
  const fields = formatFieldLines(args, [
    "name",
    "goal",
    "target_audience",
    "description",
    "start_date",
    "end_date",
    "posting_frequency",
    "timezone",
    "total_posts_planned",
  ]);
  lines.push(...(fields.length ? fields : ["- (no field changes detected)"]));
  lines.push("", "Approve to apply, or reject to keep the current campaign.");
  return lines.join("\n");
}

export function formatCampaignScheduleDraft(args: Record<string, unknown>): string {
  const lines = ["Proposed additional scheduled posts:"];
  const fields = formatFieldLines(args, [
    "campaign_id",
    "name",
    "count",
    "interval_days",
    "anchor_scheduled_post_id",
    "topic_hint",
  ]);
  lines.push(...(fields.length ? fields : ["- (no schedule details detected)"]));
  lines.push("", "Approve to schedule, or reject to skip.");
  return lines.join("\n");
}

async function requireCampaignId(
  repo: CampaignRepository,
  ctx: CampaignToolContext,
  raw: Record<string, unknown>,
): Promise<string> {
  const resolved = await resolveCampaignIdForTool(repo, ctx.siteId, ctx.userId, raw);
  if (!resolved) {
    throw new Error("campaign_id is required. Call campaign_list first, or pass a unique name.");
  }
  return resolved.campaignId;
}

function addDaysPreserveTime(anchor: Date, days: number): Date {
  const next = new Date(anchor.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

/**
 * Campaign tools owned by the campaigns skill.
 * Unlocked via skill middleware after load_skill.
 */
export function createCampaignTools(ctx: CampaignToolContext) {
  const campaignService = container.resolve(CampaignService);
  const campaignRepository = container.resolve(CampaignRepository);
  const planningService = container.resolve(CampaignPlanningService);
  const roadmapService = container.resolve(CampaignRoadmapService);
  const progressService = container.resolve(CampaignProgressReportService);
  const healthService = container.resolve(CampaignHealthService);
  const scheduledPostRepository = container.resolve(ScheduledPostRepository);
  const scheduledPostService = container.resolve(ScheduledPostService);

  const campaign_list = tool(
    async () => {
      const result = await campaignRepository.findAll(ctx.siteId, { limit: 20 });
      const campaigns = result.data.map((c) => ({
        id: c._id?.toString(),
        campaign_id: c._id?.toString(),
        name: c.name,
        goal: truncate(c.goal || "", 120),
        lifecycle_status: c.lifecycle_status,
        health_status: c.health_status,
      }));
      return toolResult(`Found ${campaigns.length} campaign(s).`, { campaigns });
    },
    {
      name: "campaign_list",
      description:
        "List campaigns in this workspace (up to 20). Returns compact name/goal/status for you — paraphrase for the user.",
      schema: z.object({}),
    },
  );

  const campaign_get = tool(
    async (input: z.infer<typeof campaignLookupSchema>) => {
      const campaignId = await requireCampaignId(campaignRepository, ctx, input as Record<string, unknown>);
      const campaign = await campaignRepository.findById(campaignId, ctx.siteId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }
      const roadmap = await roadmapService.getRoadmap(campaignId, ctx.siteId);
      const current = roadmap.current;
      return toolResult(`Campaign '${campaign.name}' — ${truncate(campaign.goal || "")}`, {
        ...campaignEntityFields(campaign),
        roadmap_version: current?.version,
        roadmap_status: current?.status,
        roadmap_summary: current?.summary,
      });
    },
    {
      name: "campaign_get",
      description:
        "Read one campaign including goal, dates, health, and latest roadmap. Pass campaign_id or a unique name.",
      schema: campaignLookupSchema,
    },
  );

  const campaign_create = tool(
    async (input: z.infer<typeof createCampaignSchema>) => {
      const parsed = createCampaignSchema.parse(input);
      const campaign = await campaignService.createCampaign(ctx.userId, ctx.siteId, {
        name: parsed.name,
        goal: parsed.goal,
        target_audience: parsed.target_audience,
        description: parsed.description,
        start_date: parseDate(parsed.start_date, "start"),
        end_date: parseDate(parsed.end_date, "end"),
        posting_frequency: (parsed.posting_frequency as PostFrequency | undefined) ?? PostFrequency.WEEKLY,
        timezone: parsed.timezone,
        total_posts_planned: parsed.total_posts_planned,
        primary_topics: parsed.primary_topics,
      });
      return toolResult(`Created campaign '${campaign.name}'.`, campaignEntityFields(campaign));
    },
    {
      name: "campaign_create",
      description:
        "Create a campaign. REQUIRED: name, goal, start_date, end_date. Optional: target_audience, description, posting_frequency, timezone, total_posts_planned, primary_topics. Research audience/market/topics first. Requires human approval. Show a plain-language proposal in chat before calling.",
      schema: createCampaignSchema,
    },
  );

  const campaign_update = tool(
    async (input: z.infer<typeof updateCampaignSchema>) => {
      const parsed = updateCampaignSchema.parse(input);
      const campaignId = await requireCampaignId(
        campaignRepository,
        ctx,
        parsed as Record<string, unknown>,
      );
      const patch = {
        ...(parsed.name ? { name: parsed.name } : {}),
        ...(parsed.goal ? { goal: parsed.goal } : {}),
        ...(parsed.target_audience != null ? { target_audience: parsed.target_audience } : {}),
        ...(parsed.description != null ? { description: parsed.description } : {}),
        ...(parsed.start_date ? { start_date: parseDate(parsed.start_date, "start") } : {}),
        ...(parsed.end_date ? { end_date: parseDate(parsed.end_date, "end") } : {}),
        ...(parsed.posting_frequency
          ? { posting_frequency: parsed.posting_frequency as PostFrequency }
          : {}),
        ...(parsed.timezone ? { timezone: parsed.timezone } : {}),
        ...(parsed.total_posts_planned != null
          ? { total_posts_planned: parsed.total_posts_planned }
          : {}),
      };
      if (Object.keys(patch).length === 0) {
        throw new Error("No campaign fields to update. Pass at least one field to change.");
      }
      const campaign = await campaignService.updateCampaign(
        campaignId,
        ctx.siteId,
        ctx.userId,
        patch,
      );
      return toolResult(`Updated campaign '${campaign.name}'.`, campaignEntityFields(campaign));
    },
    {
      name: "campaign_update",
      description:
        "Patch campaign fields (name, goal, audience, dates, cadence). Requires campaign_id or a unique name. Requires human approval. Show a before→after draft in chat before calling.",
      schema: updateCampaignSchema,
    },
  );

  const campaign_generate_roadmap = tool(
    async (input: z.infer<typeof campaignLookupSchema>) => {
      const campaignId = await requireCampaignId(
        campaignRepository,
        ctx,
        input as Record<string, unknown>,
      );
      const roadmap = await planningService.planCampaign(campaignId, ctx.siteId, ctx.userId, {
        threadId: ctx.threadId,
      });
      return toolResult(
        `Proposed roadmap v${roadmap.version} with ${roadmap.items.length} posts. Approve it in the campaign UI.`,
        {
          campaign_id: campaignId,
          roadmap_id: roadmap._id?.toString(),
          version: roadmap.version,
          item_count: roadmap.items.length,
          summary: roadmap.summary,
        },
      );
    },
    {
      name: "campaign_generate_roadmap",
      description:
        "Generate a strategic content roadmap for an existing campaign. Replaces the current plan — existing roadmap posts and drafts tied to them are removed when the new roadmap is approved. Creates a roadmap approval in the campaign UI (not chat HITL). Pass campaign_id or a unique name.",
      schema: campaignLookupSchema,
    },
  );

  const campaign_get_progress = tool(
    async (input: z.infer<typeof progressSchema>) => {
      const campaignId = await requireCampaignId(
        campaignRepository,
        ctx,
        input as Record<string, unknown>,
      );
      const report = await progressService.buildDailyReport(campaignId, ctx.siteId, input.date);
      return toolResult(truncate(report.narrative_summary || "Progress report ready.", 400), {
        campaign_id: campaignId,
        date: input.date,
        narrative_summary: report.narrative_summary,
      });
    },
    {
      name: "campaign_get_progress",
      description:
        "Get the latest daily campaign progress report (metrics, risks, pending approvals). Pass campaign_id or a unique name.",
      schema: progressSchema,
    },
  );

  const campaign_get_health = tool(
    async (input: z.infer<typeof campaignLookupSchema>) => {
      const campaignId = await requireCampaignId(
        campaignRepository,
        ctx,
        input as Record<string, unknown>,
      );
      const health = await healthService.persist(campaignId, ctx.siteId);
      const reasons = health.health_reasons.join(" ");
      return toolResult(
        `Health: ${health.health_status}.${reasons ? ` ${reasons}` : ""}`,
        {
          campaign_id: campaignId,
          health_status: health.health_status,
          health_reasons: health.health_reasons,
        },
      );
    },
    {
      name: "campaign_get_health",
      description:
        "Compute and persist current campaign health. Pass campaign_id or a unique name.",
      schema: campaignLookupSchema,
    },
  );

  const campaign_schedule_additional_posts = tool(
    async (input: z.infer<typeof scheduleAdditionalSchema>) => {
      const parsed = scheduleAdditionalSchema.parse(input);
      const count = parsed.count ?? 3;
      const intervalDays = parsed.interval_days ?? 3;

      let campaignId = parsed.campaign_id;
      let anchor = parsed.anchor_scheduled_post_id
        ? await scheduledPostRepository.findById(parsed.anchor_scheduled_post_id, ctx.siteId)
        : null;

      if (anchor?.campaign_id) {
        campaignId = anchor.campaign_id;
      }

      if (!campaignId) {
        const resolved = await resolveCampaignIdForTool(
          campaignRepository,
          ctx.siteId,
          ctx.userId,
          parsed as Record<string, unknown>,
        );
        campaignId = resolved?.campaignId;
      }

      if (!campaignId) {
        const userPosts = await scheduledPostRepository.findByUser(ctx.userId, ctx.siteId);
        const withCampaign = userPosts.filter((p) => p.campaign_id);
        const ids = new Set(withCampaign.map((p) => p.campaign_id!));
        if (ids.size === 1) {
          campaignId = [...ids][0];
        }
      }

      if (!campaignId) {
        throw new Error(
          "Could not determine campaign_id. Pass campaign_id, a unique name, or anchor_scheduled_post_id.",
        );
      }

      const campaign = await campaignRepository.findById(campaignId, ctx.siteId);
      if (!campaign) {
        throw new Error("Campaign not found");
      }

      if (!anchor) {
        const inCampaign = await scheduledPostRepository.findByCampaign(campaignId, ctx.siteId);
        const active = inCampaign.filter(
          (p) =>
            p.status !== ScheduledPostStatus.CANCELLED &&
            p.status !== ScheduledPostStatus.PUBLISHED,
        );
        anchor = active.sort((a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime())[0];
      }

      if (!anchor) {
        throw new Error(
          "No anchor scheduled post found. Schedule the first post in the campaign, then call this tool again.",
        );
      }

      const created: Array<{ scheduled_post_id: string; scheduled_at: string; title: string }> = [];
      const basePrompt = [
        parsed.topic_hint,
        `Campaign goal: ${campaign.goal}`,
        campaign.target_audience ? `Audience: ${campaign.target_audience}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      for (let i = 1; i <= count; i++) {
        const at = addDaysPreserveTime(anchor.scheduled_at, i * intervalDays);
        if (at <= new Date()) {
          throw new Error(
            `Computed schedule slot ${i} (${at.toISOString()}) is in the past. Use a later anchor or fewer intervals.`,
          );
        }
        const title = `${campaign.name} — follow-up ${i}`;
        const post = await scheduledPostService.createScheduledPost(ctx.userId, ctx.siteId, {
          campaign_id: campaignId,
          title,
          scheduled_at: at,
          timezone: anchor.timezone || campaign.timezone,
          auto_generate: true,
          generation_prompt: basePrompt,
          metadata: {
            campaign_goal: campaign.goal,
            target_audience: campaign.target_audience,
            content_theme: parsed.topic_hint ?? `Follow-up ${i}`,
          },
        });
        created.push({
          scheduled_post_id: post._id!.toString(),
          scheduled_at: at.toISOString(),
          title,
        });
      }

      return toolResult(
        `Scheduled ${created.length} post(s) every ${intervalDays} day(s) from '${anchor.title}'. Each draft still needs pre-publish approval.`,
        {
          campaign_id: campaignId,
          name: campaign.name,
          anchor_scheduled_post_id: anchor._id?.toString(),
          created,
        },
      );
    },
    {
      name: "campaign_schedule_additional_posts",
      description:
        "Schedule N additional campaign posts at fixed day intervals from an anchor post. Requires human approval. Creates auto_generate posts that still need pre-publish approval.",
      schema: scheduleAdditionalSchema,
    },
  );

  return [
    campaign_list,
    campaign_get,
    campaign_create,
    campaign_update,
    campaign_generate_roadmap,
    campaign_get_progress,
    campaign_get_health,
    campaign_schedule_additional_posts,
  ] as const;
}

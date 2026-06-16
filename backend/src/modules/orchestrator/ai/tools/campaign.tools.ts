import { injectable } from "tsyringe";
import { z } from "zod";
import { CampaignRepository } from "../../../campaign/repositories/campaign.repository";
import { CampaignPlanningService } from "../../../campaign/services/campaign-planning.service";
import { CampaignRoadmapService } from "../../../campaign/services/campaign-roadmap.service";
import { CampaignProgressReportService } from "../../../campaign/services/campaign-progress-report.service";
import { CampaignHealthService } from "../../../campaign/services/campaign-health.service";
import { ScheduledPostRepository } from "../../../campaign/repositories/scheduled-post.repository";
import { ScheduledPostService } from "../../../campaign/services/scheduled-post.service";
import { ScheduledPostStatus } from "../../../../shared/constants/campaign.constant";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import {
  normalizeCampaignToolInput,
  parseToolInput,
  resolveCampaignIdForTool,
  truncateSummary,
} from "./_helpers";

@injectable()
export class CampaignListTool implements OrchestratorTool {
  name = "campaigns.list";
  description = "List campaigns in the workspace with optional status filter.";
  requiresConfirmation = false;
  constructor(private readonly campaignRepository: CampaignRepository) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const result = await this.campaignRepository.findAll(invocation.siteId, { limit: 20 });
    return {
      summary: truncateSummary(`Found ${result.data.length} campaign(s).`),
      data: result.data.map((c) => ({
        id: c._id,
        campaign_id: c._id?.toString(),
        name: c.name,
        goal: c.goal,
        lifecycle_status: c.lifecycle_status,
        health_status: c.health_status,
      })),
    };
  }
}

const getInputSchema = z.object({
  campaign_id: z.string().min(1),
});

@injectable()
export class CampaignGetTool implements OrchestratorTool {
  name = "campaigns.get";
  description = "Get campaign details including goal, dates, and health.";
  requiresConfirmation = false;
  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly roadmapService: CampaignRoadmapService
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const resolved = await resolveCampaignIdForTool(
      this.campaignRepository,
      invocation.siteId,
      invocation.userId,
      invocation.input ?? {}
    );
    if (!resolved) {
      throw new Error("campaign_id is required. Call campaigns.list first.");
    }
    const input = parseToolInput(
      getInputSchema,
      { ...normalizeCampaignToolInput(invocation.input ?? {}), campaign_id: resolved.campaignId },
      this.name
    );
    const campaign = await this.campaignRepository.findById(input.campaign_id, invocation.siteId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }
    const roadmap = await this.roadmapService.getRoadmap(input.campaign_id, invocation.siteId);
    return {
      summary: truncateSummary(`Campaign '${campaign.name}' — ${campaign.goal}`),
      data: { campaign, roadmap: roadmap.current },
    };
  }
}

@injectable()
export class CampaignGenerateRoadmapTool implements OrchestratorTool {
  name = "campaigns.generateRoadmap";
  description =
    "Generate a strategic content roadmap for an EXISTING campaign. REQUIRED: campaign_id (from campaigns.list). Optional fallback: name or goal to match one campaign. Call campaigns.list first if unsure.";
  requiresConfirmation = false;
  constructor(
    private readonly planningService: CampaignPlanningService,
    private readonly campaignRepository: CampaignRepository
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const resolved = await resolveCampaignIdForTool(
      this.campaignRepository,
      invocation.siteId,
      invocation.userId,
      invocation.input ?? {}
    );
    if (!resolved) {
      throw new Error(
        "campaign_id is required. Call campaigns.list to get the campaign id, or pass name/goal that uniquely matches one campaign in this workspace."
      );
    }
    const input = parseToolInput(
      getInputSchema,
      { ...normalizeCampaignToolInput(invocation.input ?? {}), campaign_id: resolved.campaignId },
      this.name
    );
    const roadmap = await this.planningService.planCampaign(
      input.campaign_id,
      invocation.siteId,
      invocation.userId,
      { threadId: invocation.threadId || undefined }
    );
    return {
      summary: truncateSummary(
        `Proposed roadmap v${roadmap.version} with ${roadmap.items.length} posts. Approve in the campaign UI.`
      ),
      data: roadmap,
    };
  }
}

@injectable()
export class CampaignGetProgressReportTool implements OrchestratorTool {
  name = "campaigns.getProgressReport";
  description =
    "Get the latest daily campaign progress report (metrics, risks, pending approvals). REQUIRED: campaign_id.";
  requiresConfirmation = false;
  constructor(
    private readonly progressService: CampaignProgressReportService,
    private readonly campaignRepository: CampaignRepository
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const resolved = await resolveCampaignIdForTool(
      this.campaignRepository,
      invocation.siteId,
      invocation.userId,
      invocation.input ?? {}
    );
    if (!resolved) {
      throw new Error("campaign_id is required. Call campaigns.list first.");
    }
    const input = parseToolInput(
      getInputSchema.extend({ date: z.string().optional() }),
      { ...normalizeCampaignToolInput(invocation.input ?? {}), campaign_id: resolved.campaignId },
      this.name
    );
    const report = await this.progressService.buildDailyReport(
      input.campaign_id,
      invocation.siteId,
      input.date
    );
    return {
      summary: truncateSummary(report.narrative_summary),
      data: report,
    };
  }
}

@injectable()
export class CampaignGetHealthTool implements OrchestratorTool {
  name = "campaigns.getHealth";
  description = "Compute and return current campaign health status. REQUIRED: campaign_id.";
  requiresConfirmation = false;
  constructor(
    private readonly healthService: CampaignHealthService,
    private readonly campaignRepository: CampaignRepository
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const resolved = await resolveCampaignIdForTool(
      this.campaignRepository,
      invocation.siteId,
      invocation.userId,
      invocation.input ?? {}
    );
    if (!resolved) {
      throw new Error("campaign_id is required. Call campaigns.list first.");
    }
    const input = parseToolInput(
      getInputSchema,
      { ...normalizeCampaignToolInput(invocation.input ?? {}), campaign_id: resolved.campaignId },
      this.name
    );
    const health = await this.healthService.persist(input.campaign_id, invocation.siteId);
    return {
      summary: truncateSummary(
        `Health: ${health.health_status}. ${health.health_reasons.join(" ") || ""}`
      ),
      data: health,
    };
  }
}

const scheduleAdditionalSchema = z.object({
  campaign_id: z.string().optional(),
  count: z.number().int().min(1).max(10).default(3),
  interval_days: z.number().int().min(1).max(90).default(3),
  anchor_scheduled_post_id: z.string().optional(),
  topic_hint: z.string().max(500).optional(),
});

/** Add days to a date preserving local wall-clock time (uses UTC components from anchor). */
function addDaysPreserveTime(anchor: Date, days: number): Date {
  const next = new Date(anchor.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

@injectable()
export class CampaignScheduleAdditionalPostsTool implements OrchestratorTool {
  name = "campaigns.scheduleAdditionalPosts";
  description =
    "Schedule N additional campaign posts at fixed day intervals from an anchor post (first scheduled post in the campaign, or anchor_scheduled_post_id). Creates auto_generate scheduled posts — one call handles the full batch. Use this when the user asks for multiple posts every X days from an existing scheduled post.";
  requiresConfirmation = false;

  constructor(
    private readonly campaignRepository: CampaignRepository,
    private readonly scheduledPostRepository: ScheduledPostRepository,
    private readonly scheduledPostService: ScheduledPostService
  ) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const parsed = parseToolInput(
      scheduleAdditionalSchema,
      normalizeCampaignToolInput(invocation.input ?? {}),
      this.name
    );

    let campaignId = parsed.campaign_id;
    let anchor = parsed.anchor_scheduled_post_id
      ? await this.scheduledPostRepository.findById(
          parsed.anchor_scheduled_post_id,
          invocation.siteId
        )
      : null;

    if (anchor?.campaign_id) {
      campaignId = anchor.campaign_id;
    }

    if (!campaignId) {
      const resolved = await resolveCampaignIdForTool(
        this.campaignRepository,
        invocation.siteId,
        invocation.userId,
        invocation.input ?? {}
      );
      campaignId = resolved?.campaignId;
    }

    if (!campaignId) {
      const userPosts = await this.scheduledPostRepository.findByUser(
        invocation.userId,
        invocation.siteId
      );
      const withCampaign = userPosts.filter((p) => p.campaign_id);
      const ids = new Set(withCampaign.map((p) => p.campaign_id!));
      if (ids.size === 1) {
        campaignId = [...ids][0];
      }
    }

    if (!campaignId) {
      throw new Error(
        "Could not determine campaign_id. Pass campaign_id, anchor_scheduled_post_id, or ensure exactly one campaign has scheduled posts."
      );
    }

    const campaign = await this.campaignRepository.findById(campaignId, invocation.siteId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (!anchor) {
      const inCampaign = await this.scheduledPostRepository.findByCampaign(
        campaignId,
        invocation.siteId
      );
      const active = inCampaign.filter(
        (p) =>
          p.status !== ScheduledPostStatus.CANCELLED &&
          p.status !== ScheduledPostStatus.PUBLISHED
      );
      anchor = active.sort(
        (a, b) => a.scheduled_at.getTime() - b.scheduled_at.getTime()
      )[0];
    }

    if (!anchor) {
      throw new Error(
        "No anchor scheduled post found. Schedule the first post in the campaign, then call this tool again."
      );
    }

    const created: Array<{ scheduled_post_id: string; scheduled_at: string; title: string }> =
      [];
    const basePrompt = [
      parsed.topic_hint,
      `Campaign goal: ${campaign.goal}`,
      campaign.target_audience ? `Audience: ${campaign.target_audience}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    for (let i = 1; i <= parsed.count; i++) {
      const at = addDaysPreserveTime(anchor.scheduled_at, i * parsed.interval_days);
      if (at <= new Date()) {
        throw new Error(
          `Computed schedule slot ${i} (${at.toISOString()}) is in the past. Use a later anchor or fewer intervals.`
        );
      }
      const title = `${campaign.name} — follow-up ${i}`;
      const post = await this.scheduledPostService.createScheduledPost(
        invocation.userId,
        invocation.siteId,
        {
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
        }
      );
      created.push({
        scheduled_post_id: post._id!.toString(),
        scheduled_at: at.toISOString(),
        title,
      });
    }

    return {
      summary: truncateSummary(
        `Scheduled ${created.length} post(s) every ${parsed.interval_days} day(s) from anchor '${anchor.title}' (${anchor.scheduled_at.toISOString()}). Drafts will auto-generate before each publish date; you must approve each before it goes live.`
      ),
      data: { anchor_scheduled_post_id: anchor._id?.toString(), created },
    };
  }
}

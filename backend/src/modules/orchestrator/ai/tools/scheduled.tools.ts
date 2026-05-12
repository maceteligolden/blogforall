import { injectable } from "tsyringe";
import { z } from "zod";
import { ScheduledPostService } from "../../../campaign/services/scheduled-post.service";
import { ScheduledPostStatus } from "../../../../shared/constants";
import type { ScheduledPost } from "../../../../shared/schemas/scheduled-post.schema";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput, truncateSummary } from "./_helpers";

const STATUS_VALUES: ScheduledPostStatus[] = [
  ScheduledPostStatus.PENDING,
  ScheduledPostStatus.SCHEDULED,
  ScheduledPostStatus.AWAITING_APPROVAL,
  ScheduledPostStatus.REWORK_REQUESTED,
  ScheduledPostStatus.PUBLISHED,
  ScheduledPostStatus.FAILED,
  ScheduledPostStatus.CANCELLED,
];

function project(p: ScheduledPost) {
  return {
    id: p._id?.toString(),
    blog_id: p.blog_id,
    title: p.title,
    scheduled_at: p.scheduled_at,
    timezone: p.timezone,
    status: p.status,
    rework_round: p.rework_round,
    approved_at: p.approved_at,
    prepared_at: p.prepared_at,
  };
}

// -----------------------------------------------------------------------------
// scheduled.list
// -----------------------------------------------------------------------------

const listInputSchema = z.object({
  status: z.enum(STATUS_VALUES as [ScheduledPostStatus, ...ScheduledPostStatus[]]).optional(),
  page: z.number().int().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

@injectable()
export class ScheduledListTool implements OrchestratorTool {
  name = "scheduled.list";
  description =
    "List scheduled posts in this workspace. Filter by status (pending/scheduled/awaiting_approval/rework_requested/published/failed/cancelled).";
  requiresConfirmation = false;
  constructor(private readonly service: ScheduledPostService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(listInputSchema, invocation.input, this.name);
    const result = await this.service.getAllScheduledPosts(invocation.siteId, {
      status: input.status,
      page: input.page,
      limit: input.limit ?? 20,
    });
    return {
      summary: truncateSummary(
        `${result.pagination.total} scheduled posts${input.status ? ` with status ${input.status}` : ""} (showing ${result.data.length}).`
      ),
      data: { posts: result.data.map(project), pagination: result.pagination },
    };
  }
}

// -----------------------------------------------------------------------------
// scheduled.upcomingThisWeek — convenience for the weekly digest mental model.
// -----------------------------------------------------------------------------

@injectable()
export class ScheduledUpcomingThisWeekTool implements OrchestratorTool {
  name = "scheduled.upcomingThisWeek";
  description =
    "List scheduled posts whose scheduled_at falls within the next 7 days. Useful for 'what's going out this week' queries.";
  requiresConfirmation = false;
  constructor(private readonly service: ScheduledPostService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const now = new Date();
    const end = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const posts = await this.service.getScheduledPostsByDateRange(invocation.siteId, now, end);
    return {
      summary: truncateSummary(
        `You have ${posts.length} scheduled post(s) in the next 7 days. ${
          posts.length ? `Titles: ${posts.slice(0, 5).map((p) => `'${p.title}'`).join(", ")}.` : ""
        }`
      ),
      data: {
        window: { start: now.toISOString(), end: end.toISOString() },
        posts: posts.map(project),
      },
    };
  }
}

// -----------------------------------------------------------------------------
// scheduled.get
// -----------------------------------------------------------------------------

const getInputSchema = z.object({ id: z.string().min(1) });

@injectable()
export class ScheduledGetTool implements OrchestratorTool {
  name = "scheduled.get";
  description = "Fetch a single scheduled post by id.";
  requiresConfirmation = false;
  constructor(private readonly service: ScheduledPostService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(getInputSchema, invocation.input, this.name);
    const post = await this.service.getScheduledPostById(input.id, invocation.siteId, invocation.userId);
    return {
      summary: `Scheduled post '${post.title}' is ${post.status} for ${new Date(post.scheduled_at).toISOString()}.`,
      data: project(post),
    };
  }
}

// -----------------------------------------------------------------------------
// scheduled.cancel
// -----------------------------------------------------------------------------

@injectable()
export class ScheduledCancelTool implements OrchestratorTool {
  name = "scheduled.cancel";
  description = "Cancel a scheduled post by id (the underlying blog is unaffected).";
  requiresConfirmation = false;
  constructor(private readonly service: ScheduledPostService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(getInputSchema, invocation.input, this.name);
    const post = await this.service.cancelScheduledPost(input.id, invocation.siteId, invocation.userId);
    return {
      summary: `Cancelled scheduled post '${post.title}'.`,
      data: project(post),
    };
  }
}

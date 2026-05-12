import { injectable } from "tsyringe";
import { z } from "zod";
import { BlogService } from "../../../blog/services/blog.service";
import { OrchestratorApprovalKind } from "../../../../shared/schemas/orchestrator-approval.schema";
import type {
  OrchestratorTool,
  OrchestratorToolInvocation,
  OrchestratorToolResult,
} from "../../interfaces/orchestrator.interface";
import { parseToolInput } from "./_helpers";

/**
 * Note on approval gating: per the workspace memory's approval_rules,
 * `publish_blog_requires_approval` defaults to true. The orchestrator's
 * pre-publish HITL flow (Phase 6) is the canonical approval surface for
 * scheduled publishing. For immediate publish via chat we mark these as
 * destructive so the supervisor still raises an in-chat confirmation.
 */

// -----------------------------------------------------------------------------
// blogs.publish (immediate publish via chat — gated by in-chat confirmation)
// -----------------------------------------------------------------------------

const publishInputSchema = z.object({ id: z.string().min(1) });

@injectable()
export class BlogPublishTool implements OrchestratorTool {
  name = "blogs.publish";
  description =
    "Publish a blog post immediately (no schedule). Destructive: confirmation is required.";
  requiresConfirmation = true;
  confirmationKind = OrchestratorApprovalKind.IN_CHAT_CONFIRMATION;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(publishInputSchema, invocation.input, this.name);
    const blog = await this.blogService.publishBlog(input.id, invocation.siteId, invocation.userId);
    return {
      summary: `Published '${blog.title}'.`,
      data: { id: blog._id?.toString(), status: blog.status, published_at: blog.published_at },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.unpublish (gated by in-chat confirmation)
// -----------------------------------------------------------------------------

@injectable()
export class BlogUnpublishTool implements OrchestratorTool {
  name = "blogs.unpublish";
  description = "Unpublish a previously published blog post. Destructive: confirmation is required.";
  requiresConfirmation = true;
  confirmationKind = OrchestratorApprovalKind.IN_CHAT_CONFIRMATION;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(publishInputSchema, invocation.input, this.name);
    const blog = await this.blogService.unpublishBlog(input.id, invocation.siteId, invocation.userId);
    return {
      summary: `Unpublished '${blog.title}'.`,
      data: { id: blog._id?.toString(), status: blog.status },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.schedule
// -----------------------------------------------------------------------------

const scheduleInputSchema = z.object({
  id: z.string().min(1),
  scheduled_at: z
    .string()
    .min(1)
    .describe("ISO-8601 datetime in the future."),
  timezone: z.string().max(64).optional(),
});

@injectable()
export class BlogScheduleTool implements OrchestratorTool {
  name = "blogs.schedule";
  description =
    "Schedule a blog post for future publishing. scheduled_at must be an ISO-8601 datetime in the future. The orchestrator will prepare and request human approval before the publish date.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(scheduleInputSchema, invocation.input, this.name);
    const at = new Date(input.scheduled_at);
    if (Number.isNaN(at.getTime())) {
      throw new Error("scheduled_at must be a valid ISO-8601 datetime.");
    }
    const scheduled = await this.blogService.scheduleBlogPublish(
      input.id,
      invocation.siteId,
      invocation.userId,
      { scheduled_at: at, timezone: input.timezone }
    );
    return {
      summary: `Scheduled '${scheduled.title}' for ${at.toISOString()}.`,
      data: {
        scheduled_post_id: scheduled._id?.toString(),
        blog_id: input.id,
        scheduled_at: at.toISOString(),
      },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.reschedule — convenience wrapper: cancel + schedule in one step.
// -----------------------------------------------------------------------------

const rescheduleInputSchema = z.object({
  id: z.string().min(1),
  scheduled_at: z.string().min(1),
  timezone: z.string().max(64).optional(),
});

@injectable()
export class BlogRescheduleTool implements OrchestratorTool {
  name = "blogs.reschedule";
  description = "Move a scheduled blog post to a new publish time. The existing schedule is replaced.";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(rescheduleInputSchema, invocation.input, this.name);
    const at = new Date(input.scheduled_at);
    if (Number.isNaN(at.getTime())) {
      throw new Error("scheduled_at must be a valid ISO-8601 datetime.");
    }
    // Best-effort: unschedule first (ignore "not scheduled" errors so the
    // tool is idempotent), then schedule fresh.
    try {
      await this.blogService.unscheduleBlogPublish(input.id, invocation.siteId, invocation.userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (!msg.includes("not scheduled")) throw e;
    }
    const scheduled = await this.blogService.scheduleBlogPublish(
      input.id,
      invocation.siteId,
      invocation.userId,
      { scheduled_at: at, timezone: input.timezone }
    );
    return {
      summary: `Rescheduled '${scheduled.title}' to ${at.toISOString()}.`,
      data: {
        scheduled_post_id: scheduled._id?.toString(),
        blog_id: input.id,
        scheduled_at: at.toISOString(),
      },
    };
  }
}

// -----------------------------------------------------------------------------
// blogs.cancelSchedule
// -----------------------------------------------------------------------------

const cancelScheduleInputSchema = z.object({ id: z.string().min(1) });

@injectable()
export class BlogCancelScheduleTool implements OrchestratorTool {
  name = "blogs.cancelSchedule";
  description = "Cancel a pending blog post schedule (the blog reverts to draft).";
  requiresConfirmation = false;
  constructor(private readonly blogService: BlogService) {}

  async run(invocation: OrchestratorToolInvocation): Promise<OrchestratorToolResult> {
    const input = parseToolInput(cancelScheduleInputSchema, invocation.input, this.name);
    await this.blogService.unscheduleBlogPublish(input.id, invocation.siteId, invocation.userId);
    return {
      summary: `Cancelled schedule for blog ${input.id}.`,
      data: { id: input.id },
    };
  }
}

import { injectable } from "tsyringe";
import { ForbiddenError, NotFoundError, BadRequestError } from "../../../shared/errors";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import { SiteService } from "../../site/services/site.service";
import { OrchestratorThreadRepository } from "../repositories/orchestrator-thread.repository";
import { OrchestratorMessageRepository } from "../repositories/orchestrator-message.repository";
import { listNextDueTopics, type NextDueTopic } from "../../orchestratorv2/orchestrator.next-due";
import { WorkspaceBriefService, type WorkspaceBriefPriority } from "./workspace-brief.service";
import { ThreadCacheService } from "./thread-cache.service";

export type ThreadOpenResult = {
  thread_id: string;
  assistant_message?: { id: string; content: string; created_at: Date };
  chips: string[];
  next_topics: NextDueTopic[];
  priority: WorkspaceBriefPriority;
};

/**
 * Ensures an empty active thread has a contextual proactive opener (doc 22 §5).
 * Idempotent: never duplicates the opener when the thread already has messages.
 * Does not create threads — the empty dashboard gate creates them first.
 */
@injectable()
export class ThreadOpenerService {
  constructor(
    private readonly threadRepository: OrchestratorThreadRepository,
    private readonly messageRepository: OrchestratorMessageRepository,
    private readonly workspaceBrief: WorkspaceBriefService,
    private readonly siteService: SiteService,
    private readonly cache: ThreadCacheService
  ) {}

  async ensureOpener(siteId: string, userId: string, threadId?: string): Promise<ThreadOpenResult> {
    const hasAccess = await this.siteService.hasSiteAccess(siteId, userId);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this workspace");
    }
    if (!threadId) {
      throw new BadRequestError("thread_id is required");
    }

    const brief = await this.workspaceBrief.buildBrief(siteId, userId);

    const thread = await this.threadRepository.findById(threadId, siteId);
    if (!thread) throw new NotFoundError("Thread not found");

    const campaignId = thread.focus?.campaign_id;
    const nextTopics = await listNextDueTopics(siteId, 4, campaignId).catch(() => [] as NextDueTopic[]);
    const withTopics = (result: Omit<ThreadOpenResult, "next_topics">): ThreadOpenResult => ({
      ...result,
      next_topics: nextTopics.slice(0, 4),
    });

    const resolvedId = thread._id!.toString();
    const history = await this.messageRepository.listByThread(resolvedId, siteId);
    const userMessages = history.filter((m) => m.role === OrchestratorMessageRole.USER);
    const assistantMessages = history.filter((m) => m.role === OrchestratorMessageRole.ASSISTANT);

    if (userMessages.length === 0 && nextTopics[0] && !thread.focus?.blog_id && !thread.focus?.campaign_id) {
      await this.threadRepository.setFocus(resolvedId, siteId, {
        campaign_id: nextTopics[0].campaign_id,
        roadmap_sequence_index: nextTopics[0].sequence_index,
        topic: nextTopics[0].title,
        intent: nextTopics[0].strategic_intent,
      });
    }

    if (userMessages.length > 0) {
      return withTopics({
        thread_id: resolvedId,
        chips: brief.chips,
        priority: brief.priority,
      });
    }

    if (assistantMessages.length > 0) {
      const opener = assistantMessages[0] as OrchestratorMessage;
      return withTopics({
        thread_id: resolvedId,
        assistant_message: {
          id: opener._id!.toString(),
          content: opener.content,
          created_at: opener.created_at ?? new Date(),
        },
        chips: brief.chips,
        priority: brief.priority,
      });
    }

    const openerLine = campaignOpenerLine(campaignId, nextTopics) ?? brief.opener_line;

    const created = await this.messageRepository.create({
      thread_id: resolvedId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: openerLine,
    });
    await this.threadRepository.touch(resolvedId);
    await this.cache.invalidateThread(siteId, resolvedId);

    return withTopics({
      thread_id: resolvedId,
      assistant_message: {
        id: created._id!.toString(),
        content: created.content,
        created_at: created.created_at ?? new Date(),
      },
      chips: brief.chips,
      priority: brief.priority,
    });
  }
}

function campaignOpenerLine(campaignId: string | undefined, nextTopics: NextDueTopic[]): string | undefined {
  const head = nextTopics[0];
  if (campaignId) {
    const campaignName = head?.campaign_name || "this campaign";
    if (head) {
      const when = head.overdue
        ? "overdue"
        : head.scheduled_at
          ? `due ${new Date(head.scheduled_at).toLocaleDateString("en-US", { weekday: "short" })}`
          : "up next";
      return `Working on ${campaignName}. Next undrafted topic: ${head.title} (${when}). Want to talk through that, pick another topic, or discuss the campaign?`;
    }
    return `Working on ${campaignName}. I can offer roadmap topics once there are undrafted items, or we can talk through the campaign itself.`;
  }
  if (!head) return undefined;
  return `This week: ${head.title} (${head.campaign_name}${
    head.scheduled_at ? `, due ${new Date(head.scheduled_at).toLocaleDateString("en-US", { weekday: "short" })}` : ""
  }). Want to talk through the angle?`;
}

import { injectable } from "tsyringe";
import { ForbiddenError, NotFoundError } from "../../../shared/errors";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import { SiteService } from "../../site/services/site.service";
import { OrchestratorThreadRepository } from "../repositories/orchestrator-thread.repository";
import { OrchestratorMessageRepository } from "../repositories/orchestrator-message.repository";
import { WorkspaceBriefService, type WorkspaceBriefPriority } from "./workspace-brief.service";

export type ThreadOpenResult = {
  thread_id: string;
  assistant_message?: { id: string; content: string; created_at: Date };
  chips: string[];
  priority: WorkspaceBriefPriority;
};

/**
 * Ensures an empty active thread has a contextual proactive opener (doc 22 §5).
 * Idempotent: never duplicates the opener when the thread already has messages.
 */
@injectable()
export class ThreadOpenerService {
  constructor(
    private readonly threadRepository: OrchestratorThreadRepository,
    private readonly messageRepository: OrchestratorMessageRepository,
    private readonly workspaceBrief: WorkspaceBriefService,
    private readonly siteService: SiteService
  ) {}

  async ensureOpener(siteId: string, userId: string, threadId?: string): Promise<ThreadOpenResult> {
    const hasAccess = await this.siteService.hasSiteAccess(siteId, userId);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this workspace");
    }

    const brief = await this.workspaceBrief.buildBrief(siteId, userId);

    let thread;
    if (threadId) {
      thread = await this.threadRepository.findById(threadId, siteId);
      if (!thread) throw new NotFoundError("Thread not found");
      if (thread.user_id !== userId) {
        throw new ForbiddenError("You do not have access to this thread");
      }
    } else {
      thread = await this.threadRepository.create({
        site_id: siteId,
        user_id: userId,
        title: "New conversation",
      });
    }

    const resolvedId = thread._id!.toString();
    const history = await this.messageRepository.listByThread(resolvedId, siteId);
    const userMessages = history.filter((m) => m.role === OrchestratorMessageRole.USER);
    const assistantMessages = history.filter((m) => m.role === OrchestratorMessageRole.ASSISTANT);

    if (userMessages.length > 0) {
      return {
        thread_id: resolvedId,
        chips: brief.chips,
        priority: brief.priority,
      };
    }

    if (assistantMessages.length > 0) {
      const opener = assistantMessages[0] as OrchestratorMessage;
      return {
        thread_id: resolvedId,
        assistant_message: {
          id: opener._id!.toString(),
          content: opener.content,
          created_at: opener.created_at ?? new Date(),
        },
        chips: brief.chips,
        priority: brief.priority,
      };
    }

    const created = await this.messageRepository.create({
      thread_id: resolvedId,
      site_id: siteId,
      role: OrchestratorMessageRole.ASSISTANT,
      content: brief.opener_line,
    });
    await this.threadRepository.touch(resolvedId);

    return {
      thread_id: resolvedId,
      assistant_message: {
        id: created._id!.toString(),
        content: created.content,
        created_at: created.created_at ?? new Date(),
      },
      chips: brief.chips,
      priority: brief.priority,
    };
  }
}

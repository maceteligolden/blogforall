import { injectable } from "tsyringe";
import { ForbiddenError, NotFoundError } from "../../../shared/errors";
import { SiteMemberRole } from "../../../shared/constants";
import { canChat } from "../../../shared/utils/site-permissions.util";
import { REALTIME_EVENTS } from "../../../shared/realtime";
import { RealtimeService } from "../../../shared/realtime/services/realtime.service";
import { SiteService } from "../../site/services/site.service";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { CampaignRepository } from "../../campaign/repositories/campaign.repository";
import { WorkspaceStrategyRepository } from "../../strategic-intelligence/repositories/workspace-strategy.repository";
import { OrchestratorMessageRepository } from "../repositories/orchestrator-message.repository";
import { OrchestratorThreadRepository, ThreadListOptions } from "../repositories/orchestrator-thread.repository";
import type {
  OrchestratorThread,
  OrchestratorThreadChannel,
  ThreadAssociation,
  ThreadAssociationEntityType,
} from "../../../shared/schemas/orchestrator-thread.schema";
import type { OrchestratorMessage } from "../../../shared/schemas/orchestrator-message.schema";
import { seedThreadTitle } from "../utils/thread-seed-title.helper";
import {
  buildAutoTitlePromptContext,
  sanitizeGeneratedTitle,
  shouldAutoTitleThread,
} from "../utils/thread-auto-title.helper";
import { createChatOpenAI } from "../../../shared/ai/create-chat-openai";
import { z } from "zod";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";
import { ThreadCacheService } from "./thread-cache.service";
import { ThreadWriteLockService, type ThreadLockHolder } from "./thread-write-lock.service";
import { CampaignThreadDigestService } from "./campaign-thread-digest.service";
import { listNextDueTopics } from "../../orchestratorv2/orchestrator.next-due";

export type CreateThreadInput = {
  siteId: string;
  userId: string;
  channel?: OrchestratorThreadChannel;
  associations?: ThreadAssociation[];
  focus?: OrchestratorThread["focus"];
  isOnboarding?: boolean;
  title?: string;
};

@injectable()
export class ThreadService {
  constructor(
    private readonly threads: OrchestratorThreadRepository,
    private readonly messages: OrchestratorMessageRepository,
    private readonly cache: ThreadCacheService,
    private readonly locks: ThreadWriteLockService,
    private readonly siteService: SiteService,
    private readonly blogs: BlogRepository,
    private readonly campaigns: CampaignRepository,
    private readonly strategies: WorkspaceStrategyRepository,
    private readonly realtime: RealtimeService,
    private readonly digest: CampaignThreadDigestService
  ) {}

  async assertChatAccess(siteId: string, userId: string): Promise<SiteMemberRole> {
    const has = await this.siteService.hasSiteAccess(siteId, userId);
    if (!has) throw new ForbiddenError("You do not have access to this workspace");
    const role = await this.siteService.getUserRole(siteId, userId);
    if (!canChat(role)) {
      throw new ForbiddenError("Your workspace role does not allow this action (chat).");
    }
    return role!;
  }

  async create(input: CreateThreadInput): Promise<OrchestratorThread> {
    await this.assertChatAccess(input.siteId, input.userId);
    const focus = await this.bindNextDueIfUnbound(input.siteId, input.focus);
    const associations = await this.normalizeAssociations(input.siteId, input.associations, focus);

    const blogId = associations.find((a) => a.entity_type === "blog")?.entity_id;
    if (blogId) {
      const existing = await this.threads.findByBlogId(input.siteId, blogId);
      if (existing) return existing;
    }

    const campaignId = focus?.campaign_id ?? associations.find((a) => a.entity_type === "campaign")?.entity_id;
    const sequence = focus?.roadmap_sequence_index;
    if (campaignId && sequence != null) {
      const existing = await this.threads.findByCampaignSequence(input.siteId, campaignId, sequence);
      if (existing) {
        if (focus) {
          const updated = await this.threads.setFocus(existing._id!.toString(), input.siteId, {
            ...existing.focus,
            ...focus,
          });
          await this.cache.invalidateThread(input.siteId, existing._id!.toString());
          return updated ?? existing;
        }
        return existing;
      }
    }

    const labels = await this.labelsFor(input.siteId, associations, focus);
    const seeded = input.title ? { title: input.title, title_source: "default" as const } : seedThreadTitle(labels);

    const created = await this.threads.create({
      site_id: input.siteId,
      user_id: input.userId,
      title: seeded.title,
      title_source: seeded.title_source,
      channel: input.channel || "chat",
      is_onboarding: input.isOnboarding,
      focus,
      associations,
    });
    await this.cache.invalidateSite(input.siteId);
    return created;
  }

  async list(
    siteId: string,
    userId: string,
    options: ThreadListOptions = {}
  ): Promise<{ threads: OrchestratorThread[]; next_cursor?: string }> {
    await this.assertChatAccess(siteId, userId);
    const filters = {
      includeArchived: options.includeArchived ?? false,
      entityType: options.entityType,
      entityId: options.entityId,
      q: options.q,
      limit: options.limit,
      cursor: options.cursor,
    };
    const cached = await this.cache.getList<{ threads: OrchestratorThread[]; next_cursor?: string }>(siteId, filters);
    if (cached) return cached;
    const result = await this.threads.listForSite(siteId, options);
    await this.cache.setList(siteId, result, filters);
    return result;
  }

  async getWithMessages(
    threadId: string,
    siteId: string,
    userId: string
  ): Promise<{ thread: OrchestratorThread; messages: OrchestratorMessage[]; write_lock: ThreadLockHolder | null }> {
    await this.assertChatAccess(siteId, userId);
    const cached = await this.cache.getMessages<{
      thread: OrchestratorThread;
      messages: OrchestratorMessage[];
    }>(siteId, threadId);
    const writeLock = await this.locks.peek(siteId, threadId);
    if (cached?.thread) {
      return { ...cached, write_lock: writeLock };
    }
    const thread = await this.threads.findById(threadId, siteId);
    if (!thread) throw new NotFoundError("Thread not found");
    const messages = await this.messages.listByThread(threadId, siteId);
    const payload = { thread, messages };
    await this.cache.setMessages(siteId, threadId, payload);
    return { ...payload, write_lock: writeLock };
  }

  async rename(threadId: string, siteId: string, userId: string, title: string): Promise<OrchestratorThread> {
    await this.assertChatAccess(siteId, userId);
    const thread = await this.threads.findById(threadId, siteId);
    if (!thread) throw new NotFoundError("Thread not found");
    const updated = await this.threads.rename(threadId, siteId, title, "user");
    if (!updated) throw new NotFoundError("Thread not found");
    await this.cache.invalidateThread(siteId, threadId);
    this.realtime.emitToSite(
      siteId,
      REALTIME_EVENTS.THREAD_RENAMED,
      { thread_id: threadId, title: updated.title },
      { siteId }
    );
    return updated;
  }

  async delete(threadId: string, siteId: string, userId: string): Promise<void> {
    const role = await this.assertChatAccess(siteId, userId);
    const thread = await this.threads.findById(threadId, siteId);
    if (!thread) throw new NotFoundError("Thread not found");
    const isCreator = thread.created_by === userId;
    const isAdmin = role === SiteMemberRole.OWNER || role === SiteMemberRole.ADMIN;
    if (!isCreator && !isAdmin) {
      throw new ForbiddenError("Only the thread creator or a workspace admin can delete this thread");
    }
    await this.messages.deleteByThread(threadId, siteId);
    await this.threads.delete(threadId, siteId);
    await this.cache.invalidateThread(siteId, threadId);
  }

  async updateAssociations(
    threadId: string,
    siteId: string,
    userId: string,
    associations: ThreadAssociation[]
  ): Promise<OrchestratorThread> {
    await this.assertChatAccess(siteId, userId);
    const thread = await this.threads.findById(threadId, siteId);
    if (!thread) throw new NotFoundError("Thread not found");
    const normalized = await this.normalizeAssociations(siteId, associations);
    await this.threads.addAssociations(threadId, siteId, normalized);
    await this.cache.invalidateThread(siteId, threadId);
    const campaignIds = normalized.filter((a) => a.entity_type === "campaign").map((a) => a.entity_id);
    for (const campaignId of campaignIds) {
      void this.digest.refresh(siteId, campaignId);
    }
    const updated = await this.threads.findById(threadId, siteId);
    if (!updated) throw new NotFoundError("Thread not found");
    return updated;
  }

  async invalidateAfterMessage(siteId: string, threadId: string): Promise<void> {
    await this.cache.invalidateThread(siteId, threadId);
    const thread = await this.threads.findById(threadId, siteId);
    const campaignIds = thread?.associations?.filter((a) => a.entity_type === "campaign").map((a) => a.entity_id) ?? [];
    for (const campaignId of campaignIds) {
      void this.digest.refresh(siteId, campaignId);
    }
  }

  async maybeAutoTitle(siteId: string, threadId: string): Promise<void> {
    try {
      const thread = await this.threads.findById(threadId, siteId);
      if (!thread) return;
      const history = await this.messages.listByThread(threadId, siteId, { limit: 24 });
      if (!shouldAutoTitleThread(thread, history)) return;

      const apiKey = env.orchestrator.openaiApiKey;
      if (!apiKey) return;

      const context = buildAutoTitlePromptContext(history);
      if (!context.trim()) return;

      const chat = createChatOpenAI({
        apiKey,
        model: env.orchestrator.supervisorModel || "gpt-4o-mini",
        temperature: 0.3,
        timeout: 20_000,
      });
      const structured = chat.withStructuredOutput(z.object({ title: z.string().min(3).max(80) }));
      const raw = await structured.invoke([
        {
          role: "system",
          content:
            "Generate a short conversation title (3–6 words) that captures the theme. No quotes, no trailing punctuation, no generic titles like New conversation.",
        },
        { role: "user", content: context },
      ]);
      const title = sanitizeGeneratedTitle(raw.title);
      if (!title) return;
      const updated = await this.threads.tryAutoRename(threadId, siteId, title);
      if (updated) {
        await this.cache.invalidateThread(siteId, threadId);
        this.realtime.emitToSite(
          siteId,
          REALTIME_EVENTS.THREAD_RENAMED,
          { thread_id: threadId, title: updated.title },
          { siteId }
        );
      }
    } catch (e) {
      logger.debug(
        "Auto-title skipped or failed",
        { siteId, threadId, error: (e as Error)?.message ?? String(e) },
        "ThreadService"
      );
    }
  }

  private isBoundFocus(focus?: OrchestratorThread["focus"]): boolean {
    return Boolean(focus?.blog_id || focus?.campaign_id || focus?.topic || focus?.roadmap_sequence_index != null);
  }

  /** Writing kickoffs send an empty focus object; bind the most urgent undrafted topic. */
  private async bindNextDueIfUnbound(
    siteId: string,
    focus?: OrchestratorThread["focus"]
  ): Promise<OrchestratorThread["focus"] | undefined> {
    if (!focus || this.isBoundFocus(focus)) return focus;
    const next = (await listNextDueTopics(siteId, 1).catch(() => []))[0];
    if (!next) return focus;
    return {
      campaign_id: next.campaign_id,
      roadmap_sequence_index: next.sequence_index,
      topic: next.title,
      intent: next.strategic_intent,
    };
  }

  private async normalizeAssociations(
    siteId: string,
    associations?: ThreadAssociation[],
    focus?: OrchestratorThread["focus"]
  ): Promise<ThreadAssociation[]> {
    const out: ThreadAssociation[] = [...(associations ?? [])];
    if (focus?.campaign_id) out.push({ entity_type: "campaign", entity_id: focus.campaign_id });
    if (focus?.blog_id) out.push({ entity_type: "blog", entity_id: focus.blog_id });

    const seen = new Set<string>();
    const unique = out.filter((a) => {
      const key = `${a.entity_type}:${a.entity_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const verified: ThreadAssociation[] = [];
    for (const assoc of unique) {
      const ok = await this.verifyAssociation(siteId, assoc);
      if (ok) verified.push(assoc);
    }

    const blog = verified.find((a) => a.entity_type === "blog");
    if (blog) {
      const post = await this.blogs.findById(blog.entity_id, siteId);
      if (
        post?.campaign_id &&
        !verified.some((a) => a.entity_type === "campaign" && a.entity_id === post.campaign_id)
      ) {
        verified.push({ entity_type: "campaign", entity_id: post.campaign_id });
      }
    }

    if (!verified.some((a) => a.entity_type === "strategy")) {
      const strategy = await this.strategies.findActive(siteId);
      if (strategy?._id) {
        verified.push({ entity_type: "strategy", entity_id: strategy._id.toString() });
      }
    }
    return verified;
  }

  private async verifyAssociation(siteId: string, assoc: ThreadAssociation): Promise<boolean> {
    if (assoc.entity_type === "campaign") {
      const campaign = await this.campaigns.findById(assoc.entity_id, siteId);
      return Boolean(campaign);
    }
    if (assoc.entity_type === "blog") {
      const blog = await this.blogs.findById(assoc.entity_id, siteId);
      return Boolean(blog);
    }
    if (assoc.entity_type === "strategy") {
      const strategy = await this.strategies.findActive(siteId);
      return strategy?._id?.toString() === assoc.entity_id;
    }
    return false;
  }

  private async labelsFor(
    siteId: string,
    associations: ThreadAssociation[],
    focus?: OrchestratorThread["focus"]
  ): Promise<{ blogTitle?: string; campaignName?: string; topic?: string }> {
    const topic = focus?.topic;
    const blogId = associations.find((a) => a.entity_type === "blog")?.entity_id;
    const campaignId = associations.find((a) => a.entity_type === "campaign")?.entity_id;
    const [blog, campaign] = await Promise.all([
      blogId ? this.blogs.findById(blogId, siteId) : Promise.resolve(null),
      campaignId ? this.campaigns.findById(campaignId, siteId) : Promise.resolve(null),
    ]);
    return {
      topic,
      blogTitle: blog?.title,
      campaignName: campaign?.name,
    };
  }
}

export function parseEntityType(value: string | undefined): ThreadAssociationEntityType | undefined {
  if (value === "strategy" || value === "campaign" || value === "blog") return value;
  return undefined;
}

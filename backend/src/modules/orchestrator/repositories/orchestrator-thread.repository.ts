import { randomUUID } from "crypto";
import { injectable } from "tsyringe";
import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { db } from "../../../shared/database";
import { orchestratorThreads, threadAssociations } from "../../../shared/database/schema";
import OrchestratorThreadModel, {
  OrchestratorThread,
  OrchestratorThreadChannel,
  OrchestratorThreadStatus,
  ThreadAssociation,
  ThreadAssociationEntityType,
} from "../../../shared/schemas/orchestrator-thread.schema";

type ThreadRow = typeof orchestratorThreads.$inferSelect;
type AssociationRow = typeof threadAssociations.$inferSelect;

export type ThreadListOptions = {
  limit?: number;
  includeArchived?: boolean;
  entityType?: ThreadAssociationEntityType;
  entityId?: string;
  q?: string;
  cursor?: string;
};

function focusFromRow(row: ThreadRow, associations: ThreadAssociation[]): OrchestratorThread["focus"] {
  const campaign = associations.find((a) => a.entity_type === "campaign");
  const blog = associations.find((a) => a.entity_type === "blog");
  const focus: NonNullable<OrchestratorThread["focus"]> = {};
  if (campaign) focus.campaign_id = campaign.entity_id;
  if (blog) focus.blog_id = blog.entity_id;
  if (row.topic) focus.topic = row.topic;
  if (row.intent) focus.intent = row.intent;
  if (row.roadmap_sequence_index != null) focus.roadmap_sequence_index = row.roadmap_sequence_index;
  return Object.keys(focus).length ? focus : undefined;
}

function toEntity(row: ThreadRow, associations: ThreadAssociation[] = []): OrchestratorThread {
  return {
    _id: row.id,
    site_id: row.site_id,
    user_id: row.created_by,
    created_by: row.created_by,
    title: row.title,
    title_source: row.title_source as OrchestratorThread["title_source"],
    status: row.status as OrchestratorThreadStatus,
    channel: (row.channel as OrchestratorThreadChannel) || "chat",
    is_onboarding: row.is_onboarding,
    last_activity_at: row.last_activity_at,
    focus: focusFromRow(row, associations),
    associations,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function encodeCursor(row: ThreadRow): string {
  return Buffer.from(`${row.last_activity_at.toISOString()}|${row.id}`).toString("base64url");
}

function decodeCursor(cursor: string): { at: Date; id: string } | null {
  try {
    const [at, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|");
    if (!at || !id) return null;
    const date = new Date(at);
    if (Number.isNaN(date.getTime())) return null;
    return { at: date, id };
  } catch {
    return null;
  }
}

@injectable()
export class OrchestratorThreadRepository {
  async create(input: {
    id?: string;
    site_id: string;
    user_id: string;
    title?: string;
    title_source?: OrchestratorThread["title_source"];
    is_onboarding?: boolean;
    channel?: OrchestratorThreadChannel;
    focus?: OrchestratorThread["focus"];
    associations?: ThreadAssociation[];
  }): Promise<OrchestratorThread> {
    const id = input.id || randomUUID();
    const [row] = await db
      .insert(orchestratorThreads)
      .values({
        id,
        site_id: input.site_id,
        created_by: input.user_id,
        title: input.title || "New conversation",
        title_source: input.title_source || "default",
        is_onboarding: !!input.is_onboarding,
        channel: input.channel || "chat",
        topic: input.focus?.topic,
        intent: input.focus?.intent,
        roadmap_sequence_index: input.focus?.roadmap_sequence_index,
        last_activity_at: new Date(),
      })
      .returning();

    const associations = this.focusToAssociations(input.focus, input.associations);
    if (associations.length) {
      await this.insertAssociations(id, input.site_id, associations);
    }
    const loaded = await this.associationsFor(id);
    return toEntity(row, loaded);
  }

  async setFocus(
    threadId: string,
    siteId: string,
    focus: NonNullable<OrchestratorThread["focus"]>
  ): Promise<OrchestratorThread | null> {
    const [row] = await db
      .update(orchestratorThreads)
      .set({
        topic: focus.topic ?? null,
        intent: focus.intent ?? null,
        roadmap_sequence_index: focus.roadmap_sequence_index ?? null,
        updated_at: new Date(),
      })
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)))
      .returning();
    if (!row) return null;

    const next = this.focusToAssociations(focus);
    if (next.length) {
      await this.insertAssociations(threadId, siteId, next);
    }
    const loaded = await this.associationsFor(threadId);
    return toEntity(row, loaded);
  }

  async addAssociations(threadId: string, siteId: string, associations: ThreadAssociation[]): Promise<void> {
    if (!associations.length) return;
    await this.insertAssociations(threadId, siteId, associations);
    await db
      .update(orchestratorThreads)
      .set({ updated_at: new Date() })
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)));
  }

  async clearBlogIdFromFocus(blogId: string, siteId: string): Promise<void> {
    await db
      .delete(threadAssociations)
      .where(
        and(
          eq(threadAssociations.site_id, siteId),
          eq(threadAssociations.entity_type, "blog"),
          eq(threadAssociations.entity_id, blogId)
        )
      );
  }

  async findById(threadId: string, siteId: string): Promise<OrchestratorThread | null> {
    const [row] = await db
      .select()
      .from(orchestratorThreads)
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)))
      .limit(1);
    if (!row) return null;
    const associations = await this.associationsFor(threadId);
    return toEntity(row, associations);
  }

  async findByCampaignSequence(
    siteId: string,
    campaignId: string,
    sequence: number
  ): Promise<OrchestratorThread | null> {
    const [joined] = await db
      .select({ thread: orchestratorThreads })
      .from(orchestratorThreads)
      .innerJoin(threadAssociations, eq(threadAssociations.thread_id, orchestratorThreads.id))
      .where(
        and(
          eq(orchestratorThreads.site_id, siteId),
          eq(orchestratorThreads.status, OrchestratorThreadStatus.ACTIVE),
          eq(orchestratorThreads.roadmap_sequence_index, sequence),
          eq(threadAssociations.site_id, siteId),
          eq(threadAssociations.entity_type, "campaign"),
          eq(threadAssociations.entity_id, campaignId)
        )
      )
      .orderBy(desc(orchestratorThreads.last_activity_at), desc(orchestratorThreads.id))
      .limit(1);
    if (!joined) return null;
    return this.findById(joined.thread.id, siteId);
  }

  async findByBlogId(siteId: string, blogId: string): Promise<OrchestratorThread | null> {
    const [link] = await db
      .select()
      .from(threadAssociations)
      .where(
        and(
          eq(threadAssociations.site_id, siteId),
          eq(threadAssociations.entity_type, "blog"),
          eq(threadAssociations.entity_id, blogId)
        )
      )
      .limit(1);
    if (!link) return null;
    return this.findById(link.thread_id, siteId);
  }

  async findLatestForUser(siteId: string, userId: string): Promise<OrchestratorThread | null> {
    const [row] = await db
      .select()
      .from(orchestratorThreads)
      .where(
        and(
          eq(orchestratorThreads.site_id, siteId),
          eq(orchestratorThreads.created_by, userId),
          eq(orchestratorThreads.status, OrchestratorThreadStatus.ACTIVE)
        )
      )
      .orderBy(desc(orchestratorThreads.last_activity_at))
      .limit(1);
    if (!row) return null;
    return toEntity(row, await this.associationsFor(row.id));
  }

  async listForUser(siteId: string, _userId: string, options: ThreadListOptions = {}): Promise<OrchestratorThread[]> {
    const { threads } = await this.listForSite(siteId, options);
    return threads;
  }

  async listForSite(
    siteId: string,
    options: ThreadListOptions = {}
  ): Promise<{ threads: OrchestratorThread[]; next_cursor?: string }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
    const filters = [eq(orchestratorThreads.site_id, siteId)];
    if (!options.includeArchived) {
      filters.push(eq(orchestratorThreads.status, OrchestratorThreadStatus.ACTIVE));
    }
    if (options.q?.trim()) {
      filters.push(ilike(orchestratorThreads.title, `%${options.q.trim()}%`));
    }
    const cursor = options.cursor ? decodeCursor(options.cursor) : null;
    if (cursor) {
      filters.push(
        or(
          lt(orchestratorThreads.last_activity_at, cursor.at),
          and(eq(orchestratorThreads.last_activity_at, cursor.at), lt(orchestratorThreads.id, cursor.id))
        )!
      );
    }

    let rows: ThreadRow[];
    if (options.entityType && options.entityId) {
      rows = await db
        .select({ thread: orchestratorThreads })
        .from(orchestratorThreads)
        .innerJoin(threadAssociations, eq(threadAssociations.thread_id, orchestratorThreads.id))
        .where(
          and(
            ...filters,
            eq(threadAssociations.entity_type, options.entityType),
            eq(threadAssociations.entity_id, options.entityId)
          )
        )
        .orderBy(desc(orchestratorThreads.last_activity_at), desc(orchestratorThreads.id))
        .limit(limit + 1)
        .then((joined) => joined.map((j) => j.thread));
    } else {
      rows = await db
        .select()
        .from(orchestratorThreads)
        .where(and(...filters))
        .orderBy(desc(orchestratorThreads.last_activity_at), desc(orchestratorThreads.id))
        .limit(limit + 1);
    }

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const associations = await this.associationsForIds(page.map((r) => r.id));
    const threads = page.map((row) => toEntity(row, associations.get(row.id) ?? []));
    return {
      threads,
      next_cursor: hasMore && page.length ? encodeCursor(page[page.length - 1]) : undefined,
    };
  }

  async findOnboardingThread(siteId: string, userId: string): Promise<OrchestratorThread | null> {
    const [row] = await db
      .select()
      .from(orchestratorThreads)
      .where(
        and(
          eq(orchestratorThreads.site_id, siteId),
          eq(orchestratorThreads.created_by, userId),
          eq(orchestratorThreads.is_onboarding, true),
          eq(orchestratorThreads.status, OrchestratorThreadStatus.ACTIVE)
        )
      )
      .orderBy(desc(orchestratorThreads.last_activity_at))
      .limit(1);
    if (!row) return null;
    return toEntity(row, await this.associationsFor(row.id));
  }

  async touch(threadId: string): Promise<void> {
    await db
      .update(orchestratorThreads)
      .set({ last_activity_at: new Date(), updated_at: new Date() })
      .where(eq(orchestratorThreads.id, threadId));
  }

  async rename(
    threadId: string,
    siteId: string,
    title: string,
    titleSource: "default" | "auto" | "user" = "user"
  ): Promise<OrchestratorThread | null> {
    const [row] = await db
      .update(orchestratorThreads)
      .set({ title, title_source: titleSource, updated_at: new Date() })
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)))
      .returning();
    if (!row) return null;
    return toEntity(row, await this.associationsFor(threadId));
  }

  async tryAutoRename(threadId: string, siteId: string, title: string): Promise<OrchestratorThread | null> {
    const [row] = await db
      .update(orchestratorThreads)
      .set({ title, title_source: "auto", updated_at: new Date() })
      .where(
        and(
          eq(orchestratorThreads.id, threadId),
          eq(orchestratorThreads.site_id, siteId),
          eq(orchestratorThreads.title_source, "default")
        )
      )
      .returning();
    if (!row) return null;
    return toEntity(row, await this.associationsFor(threadId));
  }

  async archive(threadId: string, siteId: string): Promise<void> {
    await db
      .update(orchestratorThreads)
      .set({ status: OrchestratorThreadStatus.ARCHIVED, updated_at: new Date() })
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)));
  }

  async markOnboardingComplete(threadId: string, siteId: string): Promise<void> {
    await db
      .update(orchestratorThreads)
      .set({ is_onboarding: false, updated_at: new Date() })
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)));
  }

  async delete(threadId: string, siteId: string): Promise<boolean> {
    const deleted = await db
      .delete(orchestratorThreads)
      .where(and(eq(orchestratorThreads.id, threadId), eq(orchestratorThreads.site_id, siteId)))
      .returning({ id: orchestratorThreads.id });
    return deleted.length > 0;
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await db.delete(orchestratorThreads).where(eq(orchestratorThreads.site_id, siteId));
  }

  async countBySiteId(siteId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(orchestratorThreads)
      .where(eq(orchestratorThreads.site_id, siteId));
    return row?.count ?? 0;
  }

  /** Used by Mongo → Postgres backfill. */
  mongoModel(): typeof OrchestratorThreadModel {
    return OrchestratorThreadModel;
  }

  private focusToAssociations(focus?: OrchestratorThread["focus"], extra?: ThreadAssociation[]): ThreadAssociation[] {
    const out: ThreadAssociation[] = [...(extra ?? [])];
    if (focus?.campaign_id) out.push({ entity_type: "campaign", entity_id: focus.campaign_id });
    if (focus?.blog_id) out.push({ entity_type: "blog", entity_id: focus.blog_id });
    const seen = new Set<string>();
    return out.filter((a) => {
      const key = `${a.entity_type}:${a.entity_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private async insertAssociations(threadId: string, siteId: string, associations: ThreadAssociation[]): Promise<void> {
    for (const assoc of associations) {
      try {
        await db
          .insert(threadAssociations)
          .values({
            thread_id: threadId,
            site_id: siteId,
            entity_type: assoc.entity_type,
            entity_id: assoc.entity_id,
          })
          .onConflictDoNothing();
      } catch {
        // Unique blog index: another thread already owns this post — leave it.
      }
    }
  }

  private async associationsFor(threadId: string): Promise<ThreadAssociation[]> {
    const rows = await db.select().from(threadAssociations).where(eq(threadAssociations.thread_id, threadId));
    return rows.map(this.toAssociation);
  }

  private async associationsForIds(threadIds: string[]): Promise<Map<string, ThreadAssociation[]>> {
    const map = new Map<string, ThreadAssociation[]>();
    if (!threadIds.length) return map;
    const rows = await db.select().from(threadAssociations).where(inArray(threadAssociations.thread_id, threadIds));
    for (const row of rows) {
      const list = map.get(row.thread_id) ?? [];
      list.push(this.toAssociation(row));
      map.set(row.thread_id, list);
    }
    return map;
  }

  private toAssociation(row: AssociationRow): ThreadAssociation {
    return {
      entity_type: row.entity_type as ThreadAssociationEntityType,
      entity_id: row.entity_id,
    };
  }
}

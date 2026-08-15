import { injectable } from "tsyringe";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Comment as CommentType } from "../../../shared/schemas/comment.schema";
import { PaginatedResponse } from "../../../shared/interfaces";
import { db } from "../../../shared/database";
import { comments, commentLikes } from "../../../shared/database/schema";
import { omitUndefined, withId } from "../../../shared/database/map-row";

type CommentRow = typeof comments.$inferSelect;

@injectable()
export class CommentRepository {
  private toEntity(row: CommentRow, likedBy: string[] = []): CommentType {
    return {
      ...withId(row),
      liked_by: likedBy,
    } as unknown as CommentType;
  }

  private async hydrateOne(row: CommentRow): Promise<CommentType> {
    const likes = await db.select().from(commentLikes).where(eq(commentLikes.comment_id, row.id));
    return this.toEntity(
      row,
      likes.map((l) => l.actor)
    );
  }

  private async hydrateMany(rows: CommentRow[]): Promise<CommentType[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const likes = await db.select().from(commentLikes).where(inArray(commentLikes.comment_id, ids));
    const likesByComment = new Map<string, string[]>();
    for (const like of likes) {
      const list = likesByComment.get(like.comment_id) ?? [];
      list.push(like.actor);
      likesByComment.set(like.comment_id, list);
    }
    return rows.map((row) => this.toEntity(row, likesByComment.get(row.id) ?? []));
  }

  private async syncLikes(commentId: string, likedBy: string[]): Promise<void> {
    await db.delete(commentLikes).where(eq(commentLikes.comment_id, commentId));
    if (!likedBy.length) return;
    await db.insert(commentLikes).values(likedBy.map((actor) => ({ comment_id: commentId, actor })));
  }

  async create(commentData: Partial<CommentType>): Promise<CommentType> {
    const { _id: _ignored, id: _idIgnored, liked_by, ...rest } = commentData as Partial<CommentType> & { id?: string };
    const [row] = await db
      .insert(comments)
      .values({
        blog: rest.blog!,
        author_name: rest.author_name!,
        content: rest.content!,
        ...omitUndefined({
          author_email: rest.author_email,
          author_id: rest.author_id,
          parent_comment: rest.parent_comment,
          is_approved: rest.is_approved,
          likes: rest.likes,
        } as Record<string, unknown>),
      })
      .returning();
    if (liked_by?.length) {
      await this.syncLikes(row.id, liked_by);
    }
    return this.hydrateOne(row);
  }

  async findById(id: string): Promise<CommentType | null> {
    const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
    return row ? this.hydrateOne(row) : null;
  }

  async findByBlog(
    blogId: string,
    filters?: { is_approved?: boolean; page?: number; limit?: number }
  ): Promise<PaginatedResponse<CommentType>> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 10;
    const offset = (page - 1) * limit;

    const conditions = [eq(comments.blog, blogId), isNull(comments.parent_comment)];
    if (filters?.is_approved !== undefined) {
      conditions.push(eq(comments.is_approved, filters.is_approved));
    }

    const where = and(...conditions);
    const [rows, totalRows] = await Promise.all([
      db.select().from(comments).where(where).orderBy(desc(comments.created_at)).limit(limit).offset(offset),
      db
        .select({ value: sql<number>`count(*)` })
        .from(comments)
        .where(where),
    ]);
    const total = Number(totalRows[0]?.value ?? 0);

    return {
      data: await this.hydrateMany(rows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findReplies(parentCommentId: string): Promise<CommentType[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.parent_comment, parentCommentId))
      .orderBy(asc(comments.created_at));
    return this.hydrateMany(rows);
  }

  async findByAuthor(authorId: string): Promise<CommentType[]> {
    const rows = await db
      .select()
      .from(comments)
      .where(eq(comments.author_id, authorId))
      .orderBy(desc(comments.created_at));
    return this.hydrateMany(rows);
  }

  async update(id: string, updateData: Partial<CommentType>): Promise<CommentType | null> {
    const { _id: _ignored, id: _idIgnored, liked_by, ...rest } = updateData as Partial<CommentType> & { id?: string };
    const [row] = await db
      .update(comments)
      .set({ ...omitUndefined(rest as Record<string, unknown>), updated_at: new Date() })
      .where(eq(comments.id, id))
      .returning();
    if (!row) return null;
    if (liked_by) {
      await this.syncLikes(id, liked_by);
    }
    return this.hydrateOne(row);
  }

  async delete(id: string): Promise<void> {
    await db.delete(comments).where(eq(comments.id, id));
  }

  async incrementLikes(id: string): Promise<void> {
    await db
      .update(comments)
      .set({ likes: sql`${comments.likes} + 1`, updated_at: new Date() })
      .where(eq(comments.id, id));
  }

  async decrementLikes(id: string): Promise<void> {
    await db
      .update(comments)
      .set({ likes: sql`${comments.likes} - 1`, updated_at: new Date() })
      .where(eq(comments.id, id));
  }

  async toggleLike(id: string, userIdOrIp: string): Promise<{ likes: number; isLiked: boolean }> {
    return db.transaction(async (tx) => {
      const [comment] = await tx.select().from(comments).where(eq(comments.id, id)).limit(1);
      if (!comment) {
        throw new Error("Comment not found");
      }

      const [existing] = await tx
        .select()
        .from(commentLikes)
        .where(and(eq(commentLikes.comment_id, id), eq(commentLikes.actor, userIdOrIp)))
        .limit(1);

      if (existing) {
        await tx.delete(commentLikes).where(eq(commentLikes.id, existing.id));
        const [updated] = await tx
          .update(comments)
          .set({ likes: sql`GREATEST(${comments.likes} - 1, 0)`, updated_at: new Date() })
          .where(eq(comments.id, id))
          .returning({ likes: comments.likes });
        return { likes: updated.likes, isLiked: false };
      }

      await tx.insert(commentLikes).values({ comment_id: id, actor: userIdOrIp });
      const [updated] = await tx
        .update(comments)
        .set({ likes: sql`${comments.likes} + 1`, updated_at: new Date() })
        .where(eq(comments.id, id))
        .returning({ likes: comments.likes });
      return { likes: updated.likes, isLiked: true };
    });
  }

  async getCommentCountByBlog(blogId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(comments)
      .where(and(eq(comments.blog, blogId), eq(comments.is_approved, true)));
    return Number(row?.value ?? 0);
  }
}

import { injectable } from "tsyringe";
import { and, asc, eq, sql } from "drizzle-orm";
import { SiteMember as SiteMemberType } from "../../../shared/schemas/site-member.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { SiteMemberRole } from "../../../shared/constants";
import { db } from "../../../shared/database";
import { siteMembers } from "../../../shared/database/schema";
import { withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class SiteMemberRepository {
  private toEntity(row: typeof siteMembers.$inferSelect): SiteMemberType {
    return withId(row) as unknown as SiteMemberType;
  }

  async create(memberData: Partial<SiteMemberType>): Promise<SiteMemberType> {
    const existing = await this.findBySiteAndUser(memberData.site_id!, memberData.user_id!);
    if (existing) {
      throw new BadRequestError("User is already a member of this site");
    }

    const [row] = await db
      .insert(siteMembers)
      .values({
        site_id: memberData.site_id!,
        user_id: memberData.user_id!,
        role: memberData.role ?? SiteMemberRole.VIEWER,
        joined_at: new Date(),
      })
      .returning();
    return this.toEntity(row);
  }

  async findBySiteAndUser(siteId: string, userId: string): Promise<SiteMemberType | null> {
    const [row] = await db
      .select()
      .from(siteMembers)
      .where(and(eq(siteMembers.site_id, siteId), eq(siteMembers.user_id, userId)))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findBySite(siteId: string): Promise<SiteMemberType[]> {
    const rows = await db
      .select()
      .from(siteMembers)
      .where(eq(siteMembers.site_id, siteId))
      .orderBy(asc(siteMembers.joined_at));
    return withIds(rows) as unknown as SiteMemberType[];
  }

  async findByUser(userId: string): Promise<SiteMemberType[]> {
    const rows = await db.select().from(siteMembers).where(eq(siteMembers.user_id, userId));
    return withIds(rows) as unknown as SiteMemberType[];
  }

  async updateRole(siteId: string, userId: string, role: SiteMemberRole): Promise<SiteMemberType | null> {
    const member = await this.findBySiteAndUser(siteId, userId);
    if (member?.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot change owner role");
    }

    const [row] = await db
      .update(siteMembers)
      .set({ role, updated_at: new Date() })
      .where(and(eq(siteMembers.site_id, siteId), eq(siteMembers.user_id, userId)))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async remove(siteId: string, userId: string): Promise<void> {
    const member = await this.findBySiteAndUser(siteId, userId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }

    if (member.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot remove site owner");
    }

    await db.delete(siteMembers).where(and(eq(siteMembers.site_id, siteId), eq(siteMembers.user_id, userId)));
  }

  async deleteBySite(siteId: string): Promise<void> {
    await db.delete(siteMembers).where(eq(siteMembers.site_id, siteId));
  }

  async getMemberCount(siteId: string): Promise<number> {
    const [row] = await db
      .select({ value: sql<number>`count(*)` })
      .from(siteMembers)
      .where(eq(siteMembers.site_id, siteId));
    return Number(row?.value ?? 0);
  }
}

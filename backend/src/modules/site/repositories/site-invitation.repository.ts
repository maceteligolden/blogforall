import { injectable } from "tsyringe";
import { and, desc, eq, lt } from "drizzle-orm";
import { SiteInvitation as SiteInvitationType } from "../../../shared/schemas/site-invitation.schema";
import { BadRequestError } from "../../../shared/errors";
import { InvitationStatus, SiteMemberRole } from "../../../shared/constants";
import { db, withTransaction } from "../../../shared/database";
import { siteInvitations, siteMembers } from "../../../shared/database/schema";
import { withId, withIds } from "../../../shared/database/map-row";

@injectable()
export class SiteInvitationRepository {
  private toEntity(row: typeof siteInvitations.$inferSelect): SiteInvitationType {
    return withId(row) as unknown as SiteInvitationType;
  }

  async create(invitationData: Partial<SiteInvitationType>): Promise<SiteInvitationType> {
    const existing = await db
      .select({ id: siteInvitations.id })
      .from(siteInvitations)
      .where(
        and(
          eq(siteInvitations.site_id, invitationData.site_id!),
          eq(siteInvitations.email, invitationData.email!),
          eq(siteInvitations.status, InvitationStatus.PENDING)
        )
      )
      .limit(1);

    if (existing[0]) {
      throw new BadRequestError("A pending invitation already exists for this email");
    }

    const [row] = await db
      .insert(siteInvitations)
      .values({
        site_id: invitationData.site_id!,
        email: invitationData.email!,
        role: invitationData.role ?? "viewer",
        token: invitationData.token!,
        status: invitationData.status ?? InvitationStatus.PENDING,
        invited_by: invitationData.invited_by!,
        expires_at: invitationData.expires_at!,
        accepted_at: invitationData.accepted_at,
      })
      .returning();
    return this.toEntity(row);
  }

  async findByToken(token: string): Promise<SiteInvitationType | null> {
    const [row] = await db.select().from(siteInvitations).where(eq(siteInvitations.token, token)).limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findById(id: string, siteId?: string): Promise<SiteInvitationType | null> {
    const [row] = await db
      .select()
      .from(siteInvitations)
      .where(siteId ? and(eq(siteInvitations.id, id), eq(siteInvitations.site_id, siteId)) : eq(siteInvitations.id, id))
      .limit(1);
    return row ? this.toEntity(row) : null;
  }

  async findBySite(siteId: string, status?: InvitationStatus): Promise<SiteInvitationType[]> {
    const rows = await db
      .select()
      .from(siteInvitations)
      .where(
        status
          ? and(eq(siteInvitations.site_id, siteId), eq(siteInvitations.status, status))
          : eq(siteInvitations.site_id, siteId)
      )
      .orderBy(desc(siteInvitations.created_at));
    return withIds(rows) as unknown as SiteInvitationType[];
  }

  async findByEmail(email: string, status?: InvitationStatus): Promise<SiteInvitationType[]> {
    const normalized = email.toLowerCase();
    const rows = await db
      .select()
      .from(siteInvitations)
      .where(
        status
          ? and(eq(siteInvitations.email, normalized), eq(siteInvitations.status, status))
          : eq(siteInvitations.email, normalized)
      )
      .orderBy(desc(siteInvitations.created_at));
    return withIds(rows) as unknown as SiteInvitationType[];
  }

  async updateStatus(token: string, status: InvitationStatus, acceptedAt?: Date): Promise<SiteInvitationType | null> {
    const [row] = await db
      .update(siteInvitations)
      .set({
        status,
        updated_at: new Date(),
        ...(acceptedAt ? { accepted_at: acceptedAt } : {}),
      })
      .where(eq(siteInvitations.token, token))
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async delete(token: string): Promise<void> {
    await db.delete(siteInvitations).where(eq(siteInvitations.token, token));
  }

  async deleteBySiteId(siteId: string): Promise<void> {
    await db.delete(siteInvitations).where(eq(siteInvitations.site_id, siteId));
  }

  async acceptAtomically(input: {
    token: string;
    siteId: string;
    userId: string;
    role: SiteMemberRole;
  }): Promise<void> {
    await withTransaction(async (tx) => {
      await tx.insert(siteMembers).values({
        site_id: input.siteId,
        user_id: input.userId,
        role: input.role,
        joined_at: new Date(),
      });
      await tx
        .update(siteInvitations)
        .set({
          status: InvitationStatus.ACCEPTED,
          accepted_at: new Date(),
          updated_at: new Date(),
        })
        .where(eq(siteInvitations.token, input.token));
    });
  }

  async rotateToken(
    invitationId: string,
    siteId: string,
    token: string,
    expiresAt: Date
  ): Promise<SiteInvitationType | null> {
    const [row] = await db
      .update(siteInvitations)
      .set({ token, expires_at: expiresAt, updated_at: new Date() })
      .where(
        and(
          eq(siteInvitations.id, invitationId),
          eq(siteInvitations.site_id, siteId),
          eq(siteInvitations.status, InvitationStatus.PENDING)
        )
      )
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async markExpiredForSite(siteId: string): Promise<number> {
    const rows = await db
      .update(siteInvitations)
      .set({ status: InvitationStatus.EXPIRED, updated_at: new Date() })
      .where(
        and(
          eq(siteInvitations.site_id, siteId),
          eq(siteInvitations.status, InvitationStatus.PENDING),
          lt(siteInvitations.expires_at, new Date())
        )
      )
      .returning({ id: siteInvitations.id });
    return rows.length;
  }

  async reactivateInvitation(
    invitationId: string,
    siteId: string,
    token: string,
    expiresAt: Date
  ): Promise<SiteInvitationType | null> {
    const [row] = await db
      .update(siteInvitations)
      .set({
        token,
        expires_at: expiresAt,
        status: InvitationStatus.PENDING,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(siteInvitations.id, invitationId),
          eq(siteInvitations.site_id, siteId),
          eq(siteInvitations.status, InvitationStatus.EXPIRED)
        )
      )
      .returning();
    return row ? this.toEntity(row) : null;
  }

  async markExpiredInvitations(): Promise<number> {
    const rows = await db
      .update(siteInvitations)
      .set({ status: InvitationStatus.EXPIRED, updated_at: new Date() })
      .where(and(eq(siteInvitations.status, InvitationStatus.PENDING), lt(siteInvitations.expires_at, new Date())))
      .returning({ id: siteInvitations.id });
    return rows.length;
  }

  async deleteOldExpiredInvitations(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const rows = await db
      .delete(siteInvitations)
      .where(and(eq(siteInvitations.status, InvitationStatus.EXPIRED), lt(siteInvitations.updated_at, thirtyDaysAgo)))
      .returning({ id: siteInvitations.id });
    return rows.length;
  }
}

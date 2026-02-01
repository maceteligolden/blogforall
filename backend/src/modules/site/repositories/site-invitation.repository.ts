import { injectable } from "tsyringe";
import SiteInvitation, { SiteInvitation as SiteInvitationType } from "../../../shared/schemas/site-invitation.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { InvitationStatus } from "../../../shared/constants";

@injectable()
export class SiteInvitationRepository {
  /**
   * Create a new invitation
   */
  async create(invitationData: Partial<SiteInvitationType>): Promise<SiteInvitationType> {
    // Check if there's already a pending invitation for this email and site
    const existing = await SiteInvitation.findOne({
      site_id: invitationData.site_id,
      email: invitationData.email,
      status: InvitationStatus.PENDING,
    });

    if (existing) {
      throw new BadRequestError("A pending invitation already exists for this email");
    }

    const invitation = new SiteInvitation(invitationData);
    return invitation.save();
  }

  /**
   * Find invitation by token
   */
  async findByToken(token: string): Promise<SiteInvitationType | null> {
    return SiteInvitation.findOne({ token });
  }

  /**
   * Find invitations by site
   */
  async findBySite(siteId: string, status?: InvitationStatus): Promise<SiteInvitationType[]> {
    const query: Record<string, unknown> = { site_id: siteId };
    if (status) {
      query.status = status;
    }
    return SiteInvitation.find(query).sort({ created_at: -1 });
  }

  /**
   * Find invitations by email
   */
  async findByEmail(email: string, status?: InvitationStatus): Promise<SiteInvitationType[]> {
    const query: Record<string, unknown> = { email: email.toLowerCase() };
    if (status) {
      query.status = status;
    }
    return SiteInvitation.find(query).sort({ created_at: -1 });
  }

  /**
   * Update invitation status
   */
  async updateStatus(token: string, status: InvitationStatus, acceptedAt?: Date): Promise<SiteInvitationType | null> {
    const updateData: Record<string, unknown> = {
      status,
      updated_at: new Date(),
    };
    if (acceptedAt) {
      updateData.accepted_at = acceptedAt;
    }
    return SiteInvitation.findOneAndUpdate({ token }, updateData, { new: true });
  }

  /**
   * Delete invitation
   */
  async delete(token: string): Promise<void> {
    await SiteInvitation.findOneAndDelete({ token });
  }

  /**
   * Mark expired invitations
   */
  async markExpiredInvitations(): Promise<number> {
    const result = await SiteInvitation.updateMany(
      {
        status: InvitationStatus.PENDING,
        expires_at: { $lt: new Date() },
      },
      {
        status: InvitationStatus.EXPIRED,
        updated_at: new Date(),
      }
    );
    return result.modifiedCount;
  }

  /**
   * Delete old expired invitations (older than 30 days)
   */
  async deleteOldExpiredInvitations(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await SiteInvitation.deleteMany({
      status: InvitationStatus.EXPIRED,
      updated_at: { $lt: thirtyDaysAgo },
    });
    return result.deletedCount;
  }
}

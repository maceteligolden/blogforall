import { injectable } from "tsyringe";
import { randomBytes } from "crypto";
import { SiteInvitationRepository } from "../repositories/site-invitation.repository";
import { SiteRepository } from "../repositories/site.repository";
import { SiteMemberRepository } from "../repositories/site-member.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateInvitationInput, SiteInvitationWithSite } from "../interfaces/site-invitation.interface";
import { SiteInvitation } from "../../../shared/schemas/site-invitation.schema";
import { InvitationStatus, SiteMemberRole } from "../../../shared/constants";
import Site from "../../../shared/schemas/site.schema";

@injectable()
export class SiteInvitationService {
  constructor(
    private invitationRepository: SiteInvitationRepository,
    private siteRepository: SiteRepository,
    private siteMemberRepository: SiteMemberRepository,
    private userRepository: UserRepository
  ) {}

  /**
   * Generate a secure random token for invitation
   */
  private generateInvitationToken(): string {
    return randomBytes(32).toString("hex");
  }

  /**
   * Create a new invitation
   */
  async createInvitation(siteId: string, invitedBy: string, input: CreateInvitationInput): Promise<SiteInvitation> {
    // Check if site exists
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if requester has permission (owner or admin)
    const requesterRole = await this.getRequesterRole(siteId, invitedBy);
    if (requesterRole !== SiteMemberRole.OWNER && requesterRole !== SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner or admin can send invitations");
    }

    // Prevent inviting with owner role
    if (input.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot invite with owner role. Site owner is automatically set.");
    }

    // Check if user is already a member
    const user = await this.userRepository.findByEmail(input.email);
    if (user) {
      const existingMember = await this.siteMemberRepository.findBySiteAndUser(siteId, user._id!.toString());
      if (existingMember) {
        throw new BadRequestError("User is already a member of this site");
      }
    }

    // Generate token and set expiration (24 hours)
    const token = this.generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    const invitation = await this.invitationRepository.create({
      site_id: siteId,
      email: input.email.toLowerCase(),
      role: input.role,
      token,
      status: InvitationStatus.PENDING,
      invited_by: invitedBy,
      expires_at: expiresAt,
    });

    logger.info("Invitation created", { invitationId: invitation._id, siteId, email: input.email, invitedBy }, "SiteInvitationService");
    
    // TODO: Send email notification (task 13)
    // await this.sendInvitationEmail(invitation, site);

    return invitation;
  }

  /**
   * Accept an invitation
   */
  async acceptInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findByToken(token);
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    // Check if invitation is still pending
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestError(`Invitation has already been ${invitation.status}`);
    }

    // Check if invitation has expired
    if (new Date() > invitation.expires_at) {
      await this.invitationRepository.updateStatus(token, InvitationStatus.EXPIRED);
      throw new BadRequestError("Invitation has expired");
    }

    // Verify user email matches invitation email
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenError("This invitation is not for your email address");
    }

    // Check if user is already a member
    const existingMember = await this.siteMemberRepository.findBySiteAndUser(invitation.site_id, userId);
    if (existingMember) {
      throw new BadRequestError("You are already a member of this site");
    }

    // Add user as member
    await this.siteMemberRepository.create({
      site_id: invitation.site_id,
      user_id: userId,
      role: invitation.role,
    });

    // Update invitation status
    await this.invitationRepository.updateStatus(token, InvitationStatus.ACCEPTED, new Date());

    logger.info("Invitation accepted", { invitationId: invitation._id, siteId: invitation.site_id, userId }, "SiteInvitationService");
  }

  /**
   * Reject an invitation
   */
  async rejectInvitation(token: string, userId: string): Promise<void> {
    const invitation = await this.invitationRepository.findByToken(token);
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    // Verify user email matches invitation email
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new ForbiddenError("This invitation is not for your email address");
    }

    // Update invitation status
    await this.invitationRepository.updateStatus(token, InvitationStatus.REJECTED);

    logger.info("Invitation rejected", { invitationId: invitation._id, siteId: invitation.site_id, userId }, "SiteInvitationService");
  }

  /**
   * Get invitations for a site
   */
  async getSiteInvitations(siteId: string, userId: string, status?: InvitationStatus): Promise<SiteInvitation[]> {
    // Check if site exists
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if requester has permission (owner or admin)
    const requesterRole = await this.getRequesterRole(siteId, userId);
    if (requesterRole !== SiteMemberRole.OWNER && requesterRole !== SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner or admin can view invitations");
    }

    return this.invitationRepository.findBySite(siteId, status);
  }

  /**
   * Get invitations for a user (by email)
   */
  async getUserInvitations(userId: string, status?: InvitationStatus): Promise<SiteInvitationWithSite[]> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const invitations = await this.invitationRepository.findByEmail(user.email, status);

    // Populate site information
    const invitationsWithSite = await Promise.all(
      invitations.map(async (invitation) => {
        const site = await Site.findById(invitation.site_id);
        const invObj = (invitation as any).toObject ? (invitation as any).toObject() : { ...(invitation as any) };
        return {
          ...invObj,
          site: site ? {
            _id: site._id!.toString(),
            name: site.name,
            slug: site.slug,
          } : undefined,
        } as SiteInvitationWithSite;
      })
    );

    return invitationsWithSite;
  }

  /**
   * Get requester's role in site
   */
  private async getRequesterRole(siteId: string, userId: string): Promise<SiteMemberRole | null> {
    const isOwner = await this.siteRepository.isOwner(siteId, userId);
    if (isOwner) {
      return SiteMemberRole.OWNER;
    }

    const member = await this.siteMemberRepository.findBySiteAndUser(siteId, userId);
    return member?.role || null;
  }
}

import { injectable } from "tsyringe";
import { randomBytes } from "crypto";
import { SiteInvitationRepository } from "../repositories/site-invitation.repository";
import { SiteRepository } from "../repositories/site.repository";
import { SiteMemberRepository } from "../repositories/site-member.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import { NotificationService } from "../../notification/services/notification.service";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateInvitationInput, SiteInvitationWithSite } from "../interfaces/site-invitation.interface";
import { SiteInvitation } from "../../../shared/schemas/site-invitation.schema";
import { InvitationStatus, SiteMemberRole } from "../../../shared/constants";
import Site, { type Site as SiteDocument } from "../../../shared/schemas/site.schema";
import User from "../../../shared/schemas/user.schema";
import { env } from "../../../shared/config/env";
import {
  NotificationChannel,
  NotificationType,
  EMAIL_TEMPLATE_KEYS,
} from "../../../shared/constants/notification.constant";

@injectable()
export class SiteInvitationService {
  constructor(
    private invitationRepository: SiteInvitationRepository,
    private siteRepository: SiteRepository,
    private siteMemberRepository: SiteMemberRepository,
    private userRepository: UserRepository,
    private notificationService: NotificationService
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

    // Generate token and set expiration from env (days)
    const token = this.generateInvitationToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.workspace.invitationExpiryDays);

    const invitation = await this.invitationRepository.create({
      site_id: siteId,
      email: input.email.toLowerCase(),
      role: input.role,
      token,
      status: InvitationStatus.PENDING,
      invited_by: invitedBy,
      expires_at: expiresAt,
    });

    logger.info(
      "Invitation created",
      { invitationId: invitation._id, siteId, email: input.email, invitedBy },
      "SiteInvitationService"
    );

    // Notify invitee: email (async queue) and in-app if they have an account
    await this.notifyInvitee(invitation, site, invitedBy, input.email);
    if (user) {
      await this.notifyInviteeInApp(invitation, site, invitedBy, user._id!.toString());
    }

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

    // Notify inviter (in-app)
    await this.notifyInviterResponse(invitation, user, "accepted");

    logger.info(
      "Invitation accepted",
      { invitationId: invitation._id, siteId: invitation.site_id, userId },
      "SiteInvitationService"
    );
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

    // Notify inviter (in-app)
    await this.notifyInviterResponse(invitation, user, "rejected");

    logger.info(
      "Invitation rejected",
      { invitationId: invitation._id, siteId: invitation.site_id, userId },
      "SiteInvitationService"
    );
  }

  /**
   * Cancel a pending invitation (owner or admin only; only PENDING can be cancelled).
   */
  async cancelInvitation(siteId: string, invitationId: string, userId: string): Promise<void> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    const requesterRole = await this.getRequesterRole(siteId, userId);
    if (requesterRole !== SiteMemberRole.OWNER && requesterRole !== SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner or admin can cancel invitations");
    }

    const invitation = await this.invitationRepository.findById(invitationId, siteId);
    if (!invitation) {
      throw new NotFoundError("Invitation not found");
    }

    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestError("Only pending invitations can be cancelled");
    }

    await this.invitationRepository.updateStatus(invitation.token, InvitationStatus.CANCELLED);
    logger.info("Invitation cancelled", { invitationId, siteId, cancelledBy: userId }, "SiteInvitationService");
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
        const doc = invitation as { toObject?: () => Record<string, unknown> } & SiteInvitation;
        const invObj = doc.toObject ? doc.toObject() : { ...invitation };
        return {
          ...invObj,
          site: site
            ? {
                _id: site._id!.toString(),
                name: site.name,
                slug: site.slug,
              }
            : undefined,
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

  /**
   * Notify invitee by email via NotificationService (async queue, single template).
   */
  private async notifyInvitee(
    invitation: SiteInvitation,
    site: SiteDocument,
    invitedBy: string,
    email: string
  ): Promise<void> {
    try {
      const inviter = await User.findById(invitedBy);
      const inviterName = inviter
        ? `${inviter.first_name} ${inviter.last_name}`.trim() || "A team member"
        : "A team member";
      const siteName = site.name || "a site";
      const acceptUrl = `${env.frontend.baseUrl}/invitations/accept?token=${invitation.token}`;
      const roleLabel = invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1);
      const expiresAt = new Date(invitation.expires_at).toLocaleString();

      await this.notificationService.createAndSend({
        channel: NotificationChannel.EMAIL,
        type: NotificationType.SITE_INVITATION,
        recipientEmail: email,
        templateKey: EMAIL_TEMPLATE_KEYS.SITE_INVITATION,
        templateParams: {
          inviterName,
          siteName,
          roleLabel,
          acceptUrl,
          expiresAt,
        },
        payload: { site_id: invitation.site_id, invitation_id: String(invitation._id) },
      });
    } catch (error) {
      logger.error(
        "Failed to send invitation notification (email)",
        error as Error,
        { invitationId: invitation._id, email: invitation.email },
        "SiteInvitationService"
      );
    }
  }

  /**
   * Notify invitee in-app when they already have an account.
   */
  private async notifyInviteeInApp(
    invitation: SiteInvitation,
    site: SiteDocument,
    invitedBy: string,
    recipientUserId: string
  ): Promise<void> {
    try {
      const inviter = await User.findById(invitedBy);
      const inviterName = inviter
        ? `${inviter.first_name} ${inviter.last_name}`.trim() || "A team member"
        : "A team member";
      const siteName = site.name || "a site";

      await this.notificationService.createAndSend({
        channel: NotificationChannel.IN_APP,
        type: NotificationType.SITE_INVITATION,
        recipientUserId,
        title: "Workspace invitation",
        body: `${inviterName} invited you to ${siteName}`,
        payload: {
          site_id: invitation.site_id,
          site_name: siteName,
          invitation_id: String(invitation._id),
          token: invitation.token,
        },
      });
    } catch (error) {
      logger.error(
        "Failed to send invitation notification (in-app)",
        error as Error,
        { invitationId: invitation._id, recipientUserId },
        "SiteInvitationService"
      );
    }
  }

  /**
   * Notify inviter when invitee accepts or rejects (in-app).
   */
  private async notifyInviterResponse(
    invitation: SiteInvitation,
    inviteeUser: { first_name: string; last_name: string; email: string; _id?: { toString(): string } },
    response: "accepted" | "rejected"
  ): Promise<void> {
    try {
      const inviteeName = `${inviteeUser.first_name} ${inviteeUser.last_name}`.trim() || inviteeUser.email;
      const site = await this.siteRepository.findById(invitation.site_id);
      const siteName = site?.name ?? "a workspace";

      const type =
        response === "accepted" ? NotificationType.INVITATION_ACCEPTED : NotificationType.INVITATION_REJECTED;
      const title = response === "accepted" ? "Invitation accepted" : "Invitation declined";
      const body =
        response === "accepted"
          ? `${inviteeName} accepted your invitation to ${siteName}`
          : `${inviteeName} declined your invitation to ${siteName}`;

      await this.notificationService.createAndSend({
        channel: NotificationChannel.IN_APP,
        type,
        recipientUserId: invitation.invited_by,
        title,
        body,
        payload: {
          site_id: invitation.site_id,
          site_name: siteName,
          invitee_user_id: inviteeUser._id?.toString() ?? "",
          response,
        },
      });
    } catch (error) {
      logger.error(
        "Failed to notify inviter of invitation response",
        error as Error,
        { invitationId: invitation._id, response },
        "SiteInvitationService"
      );
    }
  }
}

import { injectable } from "tsyringe";
import { randomBytes } from "crypto";
import { SiteInvitationRepository } from "../repositories/site-invitation.repository";
import { SiteRepository } from "../repositories/site.repository";
import { SiteMemberRepository } from "../repositories/site-member.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { emailService } from "../../../shared/services/email.service";
import { CreateInvitationInput, SiteInvitationWithSite } from "../interfaces/site-invitation.interface";
import { SiteInvitation } from "../../../shared/schemas/site-invitation.schema";
import { InvitationStatus, SiteMemberRole } from "../../../shared/constants";
import Site from "../../../shared/schemas/site.schema";
import User from "../../../shared/schemas/user.schema";

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

    logger.info(
      "Invitation created",
      { invitationId: invitation._id, siteId, email: input.email, invitedBy },
      "SiteInvitationService"
    );

    // Send email notification
    await this.sendInvitationEmail(invitation, site, invitedBy);

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

    logger.info(
      "Invitation rejected",
      { invitationId: invitation._id, siteId: invitation.site_id, userId },
      "SiteInvitationService"
    );
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
   * Send invitation email
   */
  private async sendInvitationEmail(invitation: SiteInvitation, site: any, invitedBy: string): Promise<void> {
    try {
      const inviter = await User.findById(invitedBy);
      const inviterName = inviter ? `${inviter.first_name} ${inviter.last_name}` : "A team member";
      const siteName = site.name || "a site";

      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      const acceptUrl = `${frontendUrl}/invitations/accept?token=${invitation.token}`;
      const roleLabel = invitation.role.charAt(0).toUpperCase() + invitation.role.slice(1);

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Site Invitation - ${siteName}</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background-color: #ffffff; border-radius: 8px; padding: 40px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h1 style="color: #1a1a1a; margin-top: 0;">You've been invited!</h1>
              
              <p style="font-size: 16px; color: #666;">
                <strong>${inviterName}</strong> has invited you to collaborate on <strong>${siteName}</strong> as a <strong>${roleLabel}</strong>.
              </p>

              <div style="background-color: #f8f9fa; border-left: 4px solid #3b82f6; padding: 16px; margin: 24px 0; border-radius: 4px;">
                <p style="margin: 0; color: #495057;">
                  <strong>Site:</strong> ${siteName}<br>
                  <strong>Role:</strong> ${roleLabel}<br>
                  <strong>Expires:</strong> ${new Date(invitation.expires_at).toLocaleDateString()} at ${new Date(invitation.expires_at).toLocaleTimeString()}
                </p>
              </div>

              <div style="margin: 32px 0; text-align: center;">
                <a href="${acceptUrl}" style="display: inline-block; background-color: #3b82f6; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 6px; font-weight: 600; font-size: 16px;">
                  Accept Invitation
                </a>
              </div>

              <p style="font-size: 14px; color: #999; margin-top: 32px; border-top: 1px solid #e9ecef; padding-top: 24px;">
                If you didn't expect this invitation, you can safely ignore this email. The invitation will expire in 24 hours.
              </p>

              <p style="font-size: 12px; color: #adb5bd; margin-top: 24px;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${acceptUrl}" style="color: #3b82f6; word-break: break-all;">${acceptUrl}</a>
              </p>
            </div>

            <div style="text-align: center; margin-top: 24px; padding: 20px; color: #999; font-size: 12px;">
              <p>This email was sent by BlogForAll</p>
            </div>
          </body>
        </html>
      `;

      const text = `
You've been invited!

${inviterName} has invited you to collaborate on ${siteName} as a ${roleLabel}.

Site: ${siteName}
Role: ${roleLabel}
Expires: ${new Date(invitation.expires_at).toLocaleDateString()} at ${new Date(invitation.expires_at).toLocaleTimeString()}

Accept the invitation by clicking this link:
${acceptUrl}

If you didn't expect this invitation, you can safely ignore this email. The invitation will expire in 24 hours.
      `.trim();

      await emailService.sendEmail({
        to: invitation.email,
        subject: `You've been invited to collaborate on ${siteName}`,
        html,
        text,
      });
    } catch (error) {
      logger.error(
        "Failed to send invitation email",
        error as Error,
        { invitationId: invitation._id, email: invitation.email },
        "SiteInvitationService"
      );
      // Don't throw - email failure shouldn't prevent invitation creation
    }
  }
}

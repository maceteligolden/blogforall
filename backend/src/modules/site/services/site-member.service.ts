import { injectable } from "tsyringe";
import { SiteMemberRepository } from "../repositories/site-member.repository";
import { SiteRepository } from "../repositories/site.repository";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { AddMemberInput, UpdateMemberRoleInput, SiteMemberWithUser } from "../interfaces/site-member.interface";
import { SiteMember } from "../../../shared/schemas/site-member.schema";
import { SiteMemberRole } from "../../../shared/constants";
import User from "../../../shared/schemas/user.schema";

@injectable()
export class SiteMemberService {
  constructor(
    private siteMemberRepository: SiteMemberRepository,
    private siteRepository: SiteRepository
  ) {}

  /**
   * Add a member to a site
   */
  async addMember(siteId: string, userId: string, input: AddMemberInput): Promise<SiteMember> {
    // Check if site exists
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if requester has permission (owner or admin)
    const requesterRole = await this.getRequesterRole(siteId, userId);
    if (requesterRole !== SiteMemberRole.OWNER && requesterRole !== SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner or admin can add members");
    }

    // Prevent adding owner role (only owner can be owner)
    if (input.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot assign owner role. Site owner is automatically set.");
    }

    // Check if user is already a member
    const existingMember = await this.siteMemberRepository.findBySiteAndUser(siteId, input.user_id);
    if (existingMember) {
      throw new BadRequestError("User is already a member of this site");
    }

    // Check if user exists
    const user = await User.findById(input.user_id);
    if (!user) {
      throw new NotFoundError("User not found");
    }

    const member = await this.siteMemberRepository.create({
      site_id: siteId,
      user_id: input.user_id,
      role: input.role,
    });

    logger.info("Member added to site", { siteId, memberId: member._id, addedBy: userId }, "SiteMemberService");
    return member;
  }

  /**
   * Get all members of a site
   */
  async getMembers(siteId: string, userId: string): Promise<SiteMemberWithUser[]> {
    // Check if site exists
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if requester has access
    const hasAccess = await this.siteRepository.isOwner(siteId, userId) || 
                     await this.siteMemberRepository.findBySiteAndUser(siteId, userId);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this site");
    }

    const members = await this.siteMemberRepository.findBySite(siteId);
    
    // Populate user information
    const membersWithUser = await Promise.all(
      members.map(async (member) => {
        const user = await User.findById(member.user_id);
        const memberObj = (member as any).toObject ? (member as any).toObject() : { ...(member as any) };
        return {
          ...memberObj,
          user: user ? {
            _id: user._id!.toString(),
            email: user.email,
            first_name: user.first_name,
            last_name: user.last_name,
          } : undefined,
        } as SiteMemberWithUser;
      })
    );

    return membersWithUser;
  }

  /**
   * Update member role
   */
  async updateMemberRole(
    siteId: string,
    targetUserId: string,
    requesterUserId: string,
    input: UpdateMemberRoleInput
  ): Promise<SiteMember> {
    // Check if site exists
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if requester has permission (owner or admin)
    const requesterRole = await this.getRequesterRole(siteId, requesterUserId);
    if (requesterRole !== SiteMemberRole.OWNER && requesterRole !== SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner or admin can update member roles");
    }

    // Prevent changing owner role
    const targetMember = await this.siteMemberRepository.findBySiteAndUser(siteId, targetUserId);
    if (!targetMember) {
      throw new NotFoundError("Member not found");
    }

    if (targetMember.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot change owner role");
    }

    // Prevent assigning owner role
    if (input.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot assign owner role. Site owner is automatically set.");
    }

    // Prevent admin from changing other admin roles (only owner can)
    if (targetMember.role === SiteMemberRole.ADMIN && requesterRole === SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner can change admin roles");
    }

    const updatedMember = await this.siteMemberRepository.updateRole(siteId, targetUserId, input.role);
    if (!updatedMember) {
      throw new NotFoundError("Member not found");
    }

    logger.info("Member role updated", { siteId, targetUserId, newRole: input.role, updatedBy: requesterUserId }, "SiteMemberService");
    return updatedMember;
  }

  /**
   * Remove member from site
   */
  async removeMember(siteId: string, targetUserId: string, requesterUserId: string): Promise<void> {
    // Check if site exists
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if requester has permission (owner or admin)
    const requesterRole = await this.getRequesterRole(siteId, requesterUserId);
    if (requesterRole !== SiteMemberRole.OWNER && requesterRole !== SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner or admin can remove members");
    }

    // Prevent removing owner
    const targetMember = await this.siteMemberRepository.findBySiteAndUser(siteId, targetUserId);
    if (targetMember?.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot remove site owner");
    }

    // Prevent admin from removing other admins (only owner can)
    if (targetMember?.role === SiteMemberRole.ADMIN && requesterRole === SiteMemberRole.ADMIN) {
      throw new ForbiddenError("Only site owner can remove admin members");
    }

    await this.siteMemberRepository.remove(siteId, targetUserId);
    logger.info("Member removed from site", { siteId, targetUserId, removedBy: requesterUserId }, "SiteMemberService");
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

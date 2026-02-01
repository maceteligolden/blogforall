import { injectable } from "tsyringe";
import SiteMember, { SiteMember as SiteMemberType } from "../../../shared/schemas/site-member.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";
import { SiteMemberRole } from "../../../shared/constants";

@injectable()
export class SiteMemberRepository {
  /**
   * Create a new site member
   */
  async create(memberData: Partial<SiteMemberType>): Promise<SiteMemberType> {
    // Check if member already exists
    const existing = await SiteMember.findOne({
      site_id: memberData.site_id,
      user_id: memberData.user_id,
    });

    if (existing) {
      throw new BadRequestError("User is already a member of this site");
    }

    const member = new SiteMember({
      ...memberData,
      joined_at: new Date(),
    });
    return member.save();
  }

  /**
   * Find member by site and user
   */
  async findBySiteAndUser(siteId: string, userId: string): Promise<SiteMemberType | null> {
    return SiteMember.findOne({ site_id: siteId, user_id: userId });
  }

  /**
   * Find all members of a site
   */
  async findBySite(siteId: string): Promise<SiteMemberType[]> {
    return SiteMember.find({ site_id: siteId }).sort({ joined_at: 1 });
  }

  /**
   * Find all sites a user is a member of
   */
  async findByUser(userId: string): Promise<SiteMemberType[]> {
    return SiteMember.find({ user_id: userId });
  }

  /**
   * Update member role
   */
  async updateRole(siteId: string, userId: string, role: SiteMemberRole): Promise<SiteMemberType | null> {
    // Prevent changing owner role
    const member = await this.findBySiteAndUser(siteId, userId);
    if (member?.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot change owner role");
    }

    return SiteMember.findOneAndUpdate(
      { site_id: siteId, user_id: userId },
      { role, updated_at: new Date() },
      { new: true }
    );
  }

  /**
   * Remove member from site
   */
  async remove(siteId: string, userId: string): Promise<void> {
    const member = await this.findBySiteAndUser(siteId, userId);
    if (!member) {
      throw new NotFoundError("Member not found");
    }

    // Prevent removing owner
    if (member.role === SiteMemberRole.OWNER) {
      throw new BadRequestError("Cannot remove site owner");
    }

    await SiteMember.findOneAndDelete({ site_id: siteId, user_id: userId });
  }

  /**
   * Delete all members of a site (used when deleting site)
   */
  async deleteBySite(siteId: string): Promise<void> {
    await SiteMember.deleteMany({ site_id: siteId });
  }

  /**
   * Get member count for a site
   */
  async getMemberCount(siteId: string): Promise<number> {
    return SiteMember.countDocuments({ site_id: siteId });
  }
}

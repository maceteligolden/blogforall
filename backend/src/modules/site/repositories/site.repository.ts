import { injectable } from "tsyringe";
import Site, { Site as SiteType } from "../../../shared/schemas/site.schema";
import SiteMember from "../../../shared/schemas/site-member.schema";
import { NotFoundError, BadRequestError } from "../../../shared/errors";

@injectable()
export class SiteRepository {
  /**
   * Generate a URL-friendly slug from site name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "") // Remove special characters
      .replace(/[\s_-]+/g, "-") // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ""); // Remove leading/trailing hyphens
  }

  /**
   * Ensure slug is unique globally
   */
  private async ensureUniqueSlug(slug: string, excludeId?: string): Promise<string> {
    let uniqueSlug = slug;
    let counter = 1;

    while (true) {
      const existingSite = await Site.findOne({
        slug: uniqueSlug,
        ...(excludeId ? { _id: { $ne: excludeId } } : {}),
      });

      if (!existingSite) {
        break;
      }
      uniqueSlug = `${slug}-${counter}`;
      counter++;
    }

    return uniqueSlug;
  }

  /**
   * Create a new site
   */
  async create(siteData: Partial<SiteType>): Promise<SiteType> {
    const name = siteData.name as string;

    // Generate slug
    const baseSlug = this.generateSlug(name);
    const slug = await this.ensureUniqueSlug(baseSlug);

    const site = new Site({
      ...siteData,
      slug,
    });
    return site.save();
  }

  /**
   * Find site by ID
   */
  async findById(id: string): Promise<SiteType | null> {
    return Site.findById(id);
  }

  /**
   * Find site by slug
   */
  async findBySlug(slug: string): Promise<SiteType | null> {
    return Site.findOne({ slug });
  }

  /**
   * Find all sites owned by a user
   */
  async findByOwner(ownerId: string): Promise<SiteType[]> {
    return Site.find({ owner: ownerId }).sort({ created_at: -1 });
  }

  /**
   * Find all sites a user has access to (as owner or member)
   */
  async findByUser(userId: string): Promise<SiteType[]> {
    // Get sites where user is owner
    const ownedSites = await Site.find({ owner: userId });

    // Get sites where user is a member
    const memberSites = await SiteMember.find({ user_id: userId });
    const memberSiteIds = memberSites.map((m) => m.site_id);

    // Get all member sites
    const sitesAsMember = memberSiteIds.length > 0 ? await Site.find({ _id: { $in: memberSiteIds } }) : [];

    // Combine and deduplicate
    const allSiteIds = new Set([
      ...ownedSites.map((s) => s._id!.toString()),
      ...sitesAsMember.map((s) => s._id!.toString()),
    ]);

    const allSites = await Site.find({ _id: { $in: Array.from(allSiteIds) } }).sort({ created_at: -1 });
    return allSites;
  }

  /**
   * Update site
   */
  async update(id: string, updateData: Partial<SiteType>): Promise<SiteType | null> {
    // If name is being updated, regenerate slug
    if (updateData.name) {
      const baseSlug = this.generateSlug(updateData.name);
      updateData.slug = await this.ensureUniqueSlug(baseSlug, id);
    }

    updateData.updated_at = new Date();
    return Site.findByIdAndUpdate(id, updateData, { new: true });
  }

  /**
   * Delete site
   */
  async delete(id: string): Promise<void> {
    await Site.findByIdAndDelete(id);
  }

  /**
   * Check if user is owner of site
   */
  async isOwner(siteId: string, userId: string): Promise<boolean> {
    const site = await Site.findOne({ _id: siteId, owner: userId });
    return !!site;
  }

  /**
   * Get site members count
   */
  async getMemberCount(siteId: string): Promise<number> {
    return SiteMember.countDocuments({ site_id: siteId });
  }
}

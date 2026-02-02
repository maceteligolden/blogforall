import { injectable } from "tsyringe";
import { SiteRepository } from "../repositories/site.repository";
import { SiteMemberRepository } from "../repositories/site-member.repository";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateSiteInput, UpdateSiteInput, SiteWithMembers } from "../interfaces/site.interface";
import { Site } from "../../../shared/schemas/site.schema";
import { SiteMemberRole } from "../../../shared/constants";
import Blog from "../../../shared/schemas/blog.schema";

@injectable()
export class SiteService {
  constructor(
    private siteRepository: SiteRepository,
    private siteMemberRepository: SiteMemberRepository,
    private subscriptionService: SubscriptionService
  ) {}

  /**
   * Create a new site
   */
  async createSite(ownerId: string, input: CreateSiteInput): Promise<Site> {
    // Check plan limits before creating site
    await this.validateSiteCreationLimit(ownerId);

    const site = await this.siteRepository.create({
      name: input.name,
      description: input.description,
      owner: ownerId,
    });

    // Automatically add owner as a member with OWNER role
    await this.siteMemberRepository.create({
      site_id: site._id!.toString(),
      user_id: ownerId,
      role: SiteMemberRole.OWNER,
    });

    logger.info("Site created", { siteId: site._id, ownerId }, "SiteService");
    return site;
  }

  /**
   * Validate that user hasn't exceeded their plan's site limit
   */
  private async validateSiteCreationLimit(userId: string): Promise<void> {
    try {
      // Get user's active subscription and plan
      const { plan } = await this.subscriptionService.getActiveSubscription(userId);

      // Get max sites allowed from plan limits
      const maxSitesAllowed = plan.limits.maxSitesAllowed ?? 1;

      // If unlimited (-1), allow creation
      if (maxSitesAllowed === -1) {
        return;
      }

      // Count sites owned by user
      const userSites = await this.siteRepository.findByOwner(userId);
      const currentSiteCount = userSites.length;

      // Check if limit is reached
      if (currentSiteCount >= maxSitesAllowed) {
        throw new BadRequestError(
          `You have reached the maximum number of sites allowed for your plan (${maxSitesAllowed}). Please upgrade your plan to create more sites.`
        );
      }
    } catch (error) {
      // If it's already a BadRequestError, rethrow it
      if (error instanceof BadRequestError) {
        throw error;
      }
      // If subscription/plan lookup fails, log but allow site creation
      // This prevents blocking users if there's a temporary issue with subscription service
      logger.error("Failed to validate site creation limit", error as Error, { userId }, "SiteService");
      // Allow creation to proceed - this is a safety measure
    }
  }

  /**
   * Get site by ID (with access check)
   */
  async getSiteById(siteId: string, userId: string): Promise<Site> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if user has access (owner or member)
    const hasAccess = await this.hasSiteAccess(siteId, userId);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this site");
    }

    return site;
  }

  /**
   * Get all sites a user has access to
   */
  async getSitesByUser(userId: string): Promise<Site[]> {
    return this.siteRepository.findByUser(userId);
  }

  /**
   * Get sites with member count
   */
  async getSitesWithMembers(userId: string): Promise<SiteWithMembers[]> {
    const sites = await this.siteRepository.findByUser(userId);

    const sitesWithMembers = await Promise.all(
      sites.map(async (site) => {
        const memberCount = await this.siteRepository.getMemberCount(site._id!.toString());
        const siteObj = (site as any).toObject ? (site as any).toObject() : { ...(site as any) };
        return {
          ...siteObj,
          memberCount,
        } as SiteWithMembers;
      })
    );

    return sitesWithMembers;
  }

  /**
   * Update site (only owner or admin can update)
   */
  async updateSite(siteId: string, userId: string, input: UpdateSiteInput): Promise<Site> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Check if user is owner or admin
    const isOwner = await this.siteRepository.isOwner(siteId, userId);
    const member = await this.siteMemberRepository.findBySiteAndUser(siteId, userId);
    const isAdmin = member?.role === SiteMemberRole.ADMIN;

    if (!isOwner && !isAdmin) {
      throw new ForbiddenError("Only site owner or admin can update site");
    }

    const updatedSite = await this.siteRepository.update(siteId, input);
    if (!updatedSite) {
      throw new NotFoundError("Site not found");
    }

    logger.info("Site updated", { siteId, userId }, "SiteService");
    return updatedSite;
  }

  /**
   * Delete site (only owner can delete)
   */
  async deleteSite(siteId: string, userId: string): Promise<void> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }

    // Only owner can delete site
    const isOwner = await this.siteRepository.isOwner(siteId, userId);
    if (!isOwner) {
      throw new ForbiddenError("Only site owner can delete site");
    }

    // Delete all blogs associated with the site
    await Blog.deleteMany({ site_id: siteId });

    // Delete all site members
    await this.siteMemberRepository.deleteBySite(siteId);

    // Delete the site
    await this.siteRepository.delete(siteId);

    logger.info("Site deleted", { siteId, userId }, "SiteService");
  }

  /**
   * Check if user has access to site (owner or member)
   */
  async hasSiteAccess(siteId: string, userId: string): Promise<boolean> {
    const isOwner = await this.siteRepository.isOwner(siteId, userId);
    if (isOwner) {
      return true;
    }

    const member = await this.siteMemberRepository.findBySiteAndUser(siteId, userId);
    return !!member;
  }

  /**
   * Get user's role in site
   */
  async getUserRole(siteId: string, userId: string): Promise<SiteMemberRole | null> {
    const isOwner = await this.siteRepository.isOwner(siteId, userId);
    if (isOwner) {
      return SiteMemberRole.OWNER;
    }

    const member = await this.siteMemberRepository.findBySiteAndUser(siteId, userId);
    return member?.role || null;
  }

  /**
   * Get site members (for use by SiteMember service)
   */
  async getSiteMembers(siteId: string, userId: string): Promise<any[]> {
    // Check if user has access
    const hasAccess = await this.hasSiteAccess(siteId, userId);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this site");
    }

    return this.siteMemberRepository.findBySite(siteId);
  }
}

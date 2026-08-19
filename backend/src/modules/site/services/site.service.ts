import { injectable, container } from "tsyringe";
import { SiteRepository } from "../repositories/site.repository";
import { SiteMemberRepository } from "../repositories/site-member.repository";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { UserRepository } from "../../auth/repositories/user.repository";
import { NotFoundError, ForbiddenError, BadRequestError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { CreateSiteInput, UpdateSiteInput, SiteWithMembers } from "../interfaces/site.interface";
import { Site } from "../../../shared/schemas/site.schema";
import { SiteMemberRole, SiteStatus } from "../../../shared/constants";
import { env } from "../../../shared/config/env";
import type { SiteMember as SiteMemberType } from "../../../shared/schemas/site-member.schema";
import { deleteMongoAiBySiteId } from "../../../shared/utils/delete-mongo-ai-by-site";
import { WorkspaceStrategyService } from "../../strategic-intelligence/services/workspace-strategy.service";
import { BusinessKnowledgeService } from "../../strategic-intelligence/services/business-knowledge.service";

@injectable()
export class SiteService {
  constructor(
    private siteRepository: SiteRepository,
    private siteMemberRepository: SiteMemberRepository,
    private subscriptionService: SubscriptionService,
    private workspaceStrategyService: WorkspaceStrategyService,
    private businessKnowledgeService: BusinessKnowledgeService,
    private userRepository: UserRepository
  ) {}

  /**
   * Create a new site
   */
  async createSite(ownerId: string, input: CreateSiteInput): Promise<Site> {
    // Check plan limits before creating site
    await this.validateSiteCreationLimit(ownerId);

    const site = await this.siteRepository.createWithOwner(ownerId, {
      name: input.name,
      description: input.description,
      website_url: input.website_url,
      owner: ownerId,
      status: SiteStatus.ACTIVE,
    });

    logger.info("Site created", { siteId: site._id, ownerId, status: site.status }, "SiteService");

    if (env.orchestrator.strategicIntelligenceEnabled) {
      const siteId = site._id!.toString();
      try {
        await this.businessKnowledgeService.seedFromWorkspaceMemory(siteId, ownerId);
        const owner = await this.userRepository.findById(ownerId);
        if (owner?.onboarding_completed) {
          await this.startStrategistBootstrap(siteId, ownerId);
        }
      } catch (err) {
        logger.warn(
          "Strategic intelligence bootstrap after site create failed",
          { siteId, error: err instanceof Error ? err.message : String(err) },
          "SiteService"
        );
      }
    }

    return site;
  }

  /**
   * Same pipeline as POST /onboarding/strategist-bootstrap.
   * Resolved lazily: SiteService is in RoomManager's graph, so constructing
   * StrategistBootstrapService from this constructor is a circular dependency.
   */
  private async startStrategistBootstrap(siteId: string, userId: string): Promise<void> {
    const { StrategistBootstrapService } = await import(
      "../../onboarding/services/strategist-bootstrap.service"
    );
    container.resolve(StrategistBootstrapService).startInBackground(siteId, userId);
  }

  /**
   * Transition a site from onboarding to active. Called by the orchestrator
   * once the mandatory onboarding chat has captured workspace context.
   */
  async markSiteActive(siteId: string, userId: string): Promise<Site> {
    const site = await this.siteRepository.findById(siteId);
    if (!site) {
      throw new NotFoundError("Site not found");
    }
    const isOwner = await this.siteRepository.isOwner(siteId, userId);
    if (!isOwner) {
      throw new ForbiddenError("Only the site owner can complete onboarding");
    }
    if (site.status === SiteStatus.ACTIVE) {
      return site;
    }
    const updated = await this.siteRepository.update(siteId, { status: SiteStatus.ACTIVE });
    if (!updated) {
      throw new NotFoundError("Site not found");
    }
    logger.info("Site marked active", { siteId, userId }, "SiteService");
    return updated;
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
   * Get sites owned by the user.
   */
  async getOwnedSitesByUser(userId: string): Promise<Site[]> {
    return this.siteRepository.findByOwner(userId);
  }

  /**
   * Ensure user has at least one workspace; create one with default name from env if none.
   * Returns the created site or null if user already had sites.
   */
  async ensureDefaultWorkspace(userId: string): Promise<Site | null> {
    const sites = await this.siteRepository.findByUser(userId);
    if (sites.length > 0) {
      return null;
    }
    const site = await this.createSite(userId, {
      name: env.workspace.defaultName,
      description: "",
    });
    logger.info("Default workspace created for user", { siteId: site._id, userId }, "SiteService");
    return site;
  }

  /**
   * Get sites with member count
   */
  async getSitesWithMembers(userId: string): Promise<SiteWithMembers[]> {
    const sites = await this.siteRepository.findByUser(userId);

    const sitesWithMembers = await Promise.all(
      sites.map(async (site) => {
        const memberCount = await this.siteRepository.getMemberCount(site._id!.toString());
        return {
          ...site,
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
    if (input.website_url) {
      this.workspaceStrategyService.startBackgroundGenerate(siteId, userId, input.website_url);
    }
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

    await this.siteRepository.delete(siteId);
    await deleteMongoAiBySiteId(siteId);

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
  async getSiteMembers(siteId: string, userId: string): Promise<SiteMemberType[]> {
    // Check if user has access
    const hasAccess = await this.hasSiteAccess(siteId, userId);
    if (!hasAccess) {
      throw new ForbiddenError("You do not have access to this site");
    }

    return this.siteMemberRepository.findBySite(siteId);
  }
}

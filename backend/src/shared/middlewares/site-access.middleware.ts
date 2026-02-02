import { Request, Response, NextFunction } from "express";
import { container } from "tsyringe";
import { ForbiddenError, BadRequestError } from "../errors";
import { SiteService } from "../../modules/site/services/site.service";
import { SiteMemberRole } from "../constants";

/**
 * Middleware to verify user has access to a site
 * Extracts siteId from params, query, or body
 * Adds site information to req.site
 */
export const siteAccessMiddleware = (options?: {
  paramName?: string;
  queryName?: string;
  bodyName?: string;
  requireRole?: SiteMemberRole[];
}) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return next(new BadRequestError("User not authenticated"));
      }

      const paramName = options?.paramName || "siteId";
      const queryName = options?.queryName || "site_id";
      const bodyName = options?.bodyName || "site_id";

      // Extract siteId from params, query, or body
      const siteId = (req.params[paramName] || req.query[queryName] || req.body[bodyName]) as string;

      if (!siteId) {
        return next(new BadRequestError("Site ID is required"));
      }

      // Get site service
      const siteService = container.resolve(SiteService);

      // Check if user has access
      const hasAccess = await siteService.hasSiteAccess(siteId, userId);
      if (!hasAccess) {
        return next(new ForbiddenError("You do not have access to this site"));
      }

      // Get user's role in the site
      const role = await siteService.getUserRole(siteId, userId);

      // Check if specific role is required
      if (options?.requireRole && role) {
        const hasRequiredRole = options.requireRole.includes(role);
        if (!hasRequiredRole) {
          return next(
            new ForbiddenError(`This action requires one of the following roles: ${options.requireRole.join(", ")}`)
          );
        }
      }

      // Add site information to request
      req.site = {
        id: siteId,
        userId,
        role,
      };

      next();
    } catch (error) {
      next(error);
    }
  };
};

/**
 * Convenience middleware for routes with :siteId param
 */
export const siteParamMiddleware = siteAccessMiddleware({ paramName: "siteId" });

/**
 * Convenience middleware for routes that require owner or admin role
 */
export const siteOwnerOrAdminMiddleware = siteAccessMiddleware({
  requireRole: [SiteMemberRole.OWNER, SiteMemberRole.ADMIN],
});

/**
 * Convenience middleware for routes that require owner role only
 */
export const siteOwnerMiddleware = siteAccessMiddleware({
  requireRole: [SiteMemberRole.OWNER],
});

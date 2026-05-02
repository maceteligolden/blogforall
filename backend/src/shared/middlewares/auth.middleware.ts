import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { UnauthorizedError, ForbiddenError } from "../errors";
import { verifyAccessToken } from "../utils/token";
import { UserRole } from "../constants";

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        currentSiteId?: string; // Site context from JWT token
        role?: string; // UserRole for admin authorization
        /** Mongo site _id bound to the API key (public API only). */
        workspaceSiteId?: string;
      };
      site?: {
        id: string;
        userId: string;
        role: import("../constants").SiteMemberRole | null;
      };
      /** Set by API key middleware for workspace/public routes. */
      accessKeyId?: string;
    }
  }
}

export const authMiddleware = (req: Request, _res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedError("No token provided");
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyAccessToken(token);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      currentSiteId: decoded.currentSiteId,
      role: decoded.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return next(new UnauthorizedError("Token expired"));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new UnauthorizedError("Invalid token"));
    }
    next(new UnauthorizedError("Invalid or expired token"));
  }
};

/**
 * PSEUDOCODE:
 * 1. REQUIRE authMiddleware to have run (req.user set)
 * 2. IF req.user.role !== UserRole.ADMIN THEN next(ForbiddenError)
 * 3. ELSE next()
 */
export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  if (!req.user) {
    return next(new UnauthorizedError("Authentication required"));
  }
  if (req.user.role !== UserRole.ADMIN) {
    return next(new ForbiddenError("Admin access required"));
  }
  next();
};

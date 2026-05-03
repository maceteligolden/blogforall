import type { Request } from "express";

/**
 * JWT-protected handlers only: `authMiddleware` must run first and guarantees `req.user.userId`.
 */
export function getJwtUserId(req: Request): string {
  return req.user!.userId;
}

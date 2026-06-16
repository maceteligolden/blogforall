import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

const allowedOrigins = new Set(env.frontend.urls.map(normalizeOrigin));

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const rawOrigin = req.headers.origin;
  const normalizedOrigin = rawOrigin ? normalizeOrigin(rawOrigin) : undefined;
  const isAllowed =
    normalizedOrigin !== undefined && allowedOrigins.has(normalizedOrigin);

  if (isAllowed && rawOrigin) {
    res.header("Access-Control-Allow-Origin", rawOrigin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, x-access-key-id, x-secret-key, x-request-id, x-session-id, sentry-trace, baggage"
    );
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(isAllowed ? 200 : 403);
  }

  next();
};

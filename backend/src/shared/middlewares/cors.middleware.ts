import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";
import { logger } from "../utils/logger";

function normalizeOrigin(value: string): string {
  const trimmed = value.trim();
  try {
    return new URL(trimmed).origin.toLowerCase();
  } catch {
    return trimmed.replace(/\/+$/, "").toLowerCase();
  }
}

function getAllowedOrigins(): Set<string> {
  return new Set(env.frontend.urls.map(normalizeOrigin));
}

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const rawOrigin = req.headers.origin;
  const normalizedOrigin = rawOrigin ? normalizeOrigin(rawOrigin) : undefined;
  const allowedOrigins = getAllowedOrigins();
  const isAllowed =
    normalizedOrigin !== undefined && allowedOrigins.has(normalizedOrigin);

  if (req.method === "OPTIONS" || !isAllowed) {
    logger.info("CORS decision", {
      method: req.method,
      path: req.path,
      rawOrigin: rawOrigin ?? null,
      normalizedOrigin: normalizedOrigin ?? null,
      isAllowed,
      allowedOrigins: [...allowedOrigins],
    });
  }

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

logger.info("CORS startup config", {
  frontendUrlEnvSet: Boolean(process.env.FRONTEND_URL),
  allowedOrigins: [...getAllowedOrigins()],
  nodeEnv: env.nodeEnv,
});

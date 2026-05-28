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

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const rawOrigin = req.headers.origin;
  const normalizedOrigin = rawOrigin ? normalizeOrigin(rawOrigin) : undefined;

  // Default allowed origins for development
  const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3001",
    "https://blogforall-ij6u.onrender.com",
    "https://admin-bloggr.netlify.app",
  ];

  const configuredOrigins =
    env.frontend.urls.length > 0 ? [...env.frontend.urls, ...defaultOrigins] : defaultOrigins;
  const normalizedAllowedOrigins = new Set(configuredOrigins.map(normalizeOrigin));
  const isLocalhostOrigin =
    normalizedOrigin !== undefined &&
    /^http:\/\/localhost:\d+$/.test(normalizedOrigin);
  const matchedConfiguredOrigin =
    normalizedOrigin === undefined
      ? undefined
      : configuredOrigins.find((origin) => normalizeOrigin(origin) === normalizedOrigin);

  // In production we only allow configured origins.
  // In development we allow configured origins + localhost ports.
  const isAllowed =
    normalizedOrigin !== undefined &&
    (normalizedAllowedOrigins.has(normalizedOrigin) || (env.isDevelopment && isLocalhostOrigin));

  if (rawOrigin && isAllowed) {
    // Prefer the configured env/default origin value when matched.
    // For dev localhost regex allowance, fall back to the request origin.
    res.header("Access-Control-Allow-Origin", matchedConfiguredOrigin ?? rawOrigin);
    res.header("Vary", "Origin");
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-access-key-id, x-secret-key, x-request-id, x-session-id, sentry-trace, baggage"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
};

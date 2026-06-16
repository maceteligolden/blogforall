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
    const debugData = {
      method: req.method,
      path: req.path,
      rawOrigin: rawOrigin ?? null,
      normalizedOrigin: normalizedOrigin ?? null,
      isAllowed,
      allowedOrigins: [...allowedOrigins],
    };

    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d1eb59" },
      body: JSON.stringify({
        sessionId: "d1eb59",
        runId: "cors-fix",
        hypothesisId: isAllowed ? "C" : rawOrigin ? "B" : "D",
        location: "cors.middleware.ts:request",
        message: isAllowed ? "CORS preflight allowed" : "CORS request denied or missing origin",
        data: debugData,
        timestamp: Date.now(),
      }),
    }).catch(() => undefined);
    // #endregion

    logger.info("CORS decision", debugData);
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

const startupAllowedOrigins = [...getAllowedOrigins()];

// #region agent log
fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d1eb59" },
  body: JSON.stringify({
    sessionId: "d1eb59",
    runId: "cors-fix",
    hypothesisId: "F",
    location: "cors.middleware.ts:startup",
    message: "CORS startup config",
    data: {
      frontendUrlEnvSet: Boolean(process.env.FRONTEND_URL),
      allowedOrigins: startupAllowedOrigins,
      nodeEnv: env.nodeEnv,
    },
    timestamp: Date.now(),
  }),
}).catch(() => undefined);
// #endregion

logger.info("CORS startup config", {
  frontendUrlEnvSet: Boolean(process.env.FRONTEND_URL),
  allowedOrigins: startupAllowedOrigins,
  nodeEnv: env.nodeEnv,
});

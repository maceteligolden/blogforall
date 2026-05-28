import { Request, Response, NextFunction } from "express";
import { env } from "../config/env";

export const corsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;

  // Default allowed origins for development
  const defaultOrigins = [
    "http://localhost:3000",
    "http://localhost:3002",
    "http://localhost:3001",
    "https://blogforall-ij6u.onrender.com",
    "https://admin-bloggr.netlify.app",
  ];

  const allowedOrigins = env.frontend.urls.length > 0 ? [...env.frontend.urls, ...defaultOrigins] : defaultOrigins;

  // Remove duplicates
  const uniqueOrigins = [...new Set(allowedOrigins)];

  // #region agent log
  fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
    body: JSON.stringify({
      sessionId: "d03c4e",
      runId: "cors-preflight",
      hypothesisId: "H1",
      location: "cors.middleware.ts:22",
      message: "CORS middleware received request",
      data: {
        method: req.method,
        path: req.path,
        origin: origin ?? null,
        isDevelopment: env.isDevelopment,
        frontendUrls: env.frontend.urls,
        allowedOriginsCount: uniqueOrigins.length,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  // In development, allow any localhost origin or configured origins
  if (env.isDevelopment) {
    if (
      origin &&
      (uniqueOrigins.includes(origin) || (origin.includes("localhost") && origin.match(/^http:\/\/localhost:\d+$/)))
    ) {
      res.header("Access-Control-Allow-Origin", origin);
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
        body: JSON.stringify({
          sessionId: "d03c4e",
          runId: "cors-preflight",
          hypothesisId: "H2",
          location: "cors.middleware.ts:42",
          message: "CORS allowed origin in development",
          data: { origin },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } else if (origin) {
      res.header("Access-Control-Allow-Origin", "*");
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
        body: JSON.stringify({
          sessionId: "d03c4e",
          runId: "cors-preflight",
          hypothesisId: "H2",
          location: "cors.middleware.ts:58",
          message: "CORS wildcard origin in development",
          data: { origin },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }
  } else {
    // In production, only allow configured origins
    if (origin && uniqueOrigins.includes(origin)) {
      res.header("Access-Control-Allow-Origin", origin);
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
        body: JSON.stringify({
          sessionId: "d03c4e",
          runId: "cors-preflight",
          hypothesisId: "H2",
          location: "cors.middleware.ts:75",
          message: "CORS allowed origin in production",
          data: { origin },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } else {
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
        body: JSON.stringify({
          sessionId: "d03c4e",
          runId: "cors-preflight",
          hypothesisId: "H3",
          location: "cors.middleware.ts:88",
          message: "CORS rejected origin in production",
          data: { origin: origin ?? null, allowedOrigins: uniqueOrigins },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    }
  }

  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, x-access-key-id, x-secret-key, x-request-id, x-session-id, sentry-trace, baggage"
  );
  res.header("Access-Control-Allow-Credentials", "true");

  if (req.method === "OPTIONS") {
    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
      body: JSON.stringify({
        sessionId: "d03c4e",
        runId: "cors-preflight",
        hypothesisId: "H4",
        location: "cors.middleware.ts:112",
        message: "Preflight response sent",
        data: {
          origin: origin ?? null,
          allowOriginHeader: res.getHeader("Access-Control-Allow-Origin") ?? null,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    return res.sendStatus(200);
  }
  next();
};

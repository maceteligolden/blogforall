import { randomUUID } from "crypto";
import { Request, Response, NextFunction } from "express";
import { getRequestIdFromHeaders } from "../utils/request-id";
import {
  getSessionIdFromHeaders,
  runWithRequestContext,
  type RequestContextStore,
} from "../observability/request-context";
import { continueIncomingTrace, setSentryScopeFromContext } from "../observability/sentry";

export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = getRequestIdFromHeaders(req) ?? randomUUID();
  const sessionId = getSessionIdFromHeaders(req);

  res.setHeader("X-Request-Id", requestId);

  const store: RequestContextStore = {
    requestId,
    sessionId,
  };

  continueIncomingTrace(req, () => {
    runWithRequestContext(store, () => {
      setSentryScopeFromContext(store);
      next();
    });
  });
};

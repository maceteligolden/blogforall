import { AsyncLocalStorage } from "async_hooks";
import type { Request } from "express";
import { getRequestIdFromHeaders } from "../utils/request-id";

export interface RequestContextStore {
  requestId: string;
  userId?: string;
  sessionId?: string;
  flow?: string;
}

const storage = new AsyncLocalStorage<RequestContextStore>();

export function runWithRequestContext<T>(store: RequestContextStore, fn: () => T): T {
  return storage.run(store, fn);
}

export function getRequestContext(): RequestContextStore | undefined {
  return storage.getStore();
}

export function setRequestContextUserId(userId: string): void {
  const store = storage.getStore();
  if (store) store.userId = userId;
}

export function setRequestContextFlow(flow: string): void {
  const store = storage.getStore();
  if (store) store.flow = flow;
}

export function getRequestIdFromContext(req?: Request): string | undefined {
  return getRequestContext()?.requestId ?? (req ? getRequestIdFromHeaders(req) : undefined);
}

export function getSessionIdFromHeaders(req: Request): string | undefined {
  const raw = req.headers["x-session-id"];
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 128);
  if (Array.isArray(raw) && raw[0]?.trim()) return raw[0].trim().slice(0, 128);
  return undefined;
}

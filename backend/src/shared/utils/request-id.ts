import type { Request } from "express";

/** Read client-provided idempotency key or return undefined for server generation. */
export function getRequestIdFromHeaders(req: Request): string | undefined {
  const raw = req.headers["x-request-id"];
  if (typeof raw === "string" && raw.trim()) {
    return raw.trim().slice(0, 128);
  }
  if (Array.isArray(raw) && raw[0]?.trim()) {
    return raw[0].trim().slice(0, 128);
  }
  return undefined;
}

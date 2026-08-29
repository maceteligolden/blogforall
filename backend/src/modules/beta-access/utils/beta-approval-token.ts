import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface BetaApprovalTokenPayload {
  userId: string;
  exp: number;
}

export function signBetaApprovalToken(
  userId: string,
  secret: string,
  options?: { now?: number; ttlMs?: number }
): string {
  if (!userId) throw new Error("userId is required");
  if (!secret) throw new Error("Beta approval token secret is not configured");
  const now = options?.now ?? Date.now();
  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const payload: BetaApprovalTokenPayload = { userId, exp: now + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyBetaApprovalToken(
  token: string,
  secret: string,
  options?: { now?: number }
): BetaApprovalTokenPayload {
  if (!secret) throw new Error("Beta approval token secret is not configured");
  const parts = (token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    throw new Error("Invalid beta approval token");
  }
  const [body, sig] = parts;
  const expected = createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Invalid beta approval token");
  }
  let payload: BetaApprovalTokenPayload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as BetaApprovalTokenPayload;
  } catch {
    throw new Error("Invalid beta approval token");
  }
  if (!payload?.userId || typeof payload.exp !== "number") {
    throw new Error("Invalid beta approval token");
  }
  const now = options?.now ?? Date.now();
  if (payload.exp < now) {
    throw new Error("Beta approval token has expired");
  }
  return payload;
}

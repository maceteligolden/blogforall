import crypto from "crypto";

/**
 * Length (in bytes) of the random portion of a review token. Final URL-safe
 * string is `~2 * RAW_TOKEN_BYTES` base64url characters.
 */
const RAW_TOKEN_BYTES = 24;

/**
 * Number of leading characters used as a non-secret lookup key in Mongo.
 * Long enough to avoid collisions with negligible probability across all
 * realistic workspaces.
 */
const LOOKUP_PREFIX_LENGTH = 16;

export interface ReviewTokenMaterial {
  /** Raw token to put in the URL. Never store this. */
  raw: string;
  /** Lookup prefix stored alongside the hash for fast row lookup. */
  lookup: string;
  /** SHA-256 hex digest of the raw token; the only persisted secret. */
  hash: string;
}

/**
 * Mint a fresh URL-safe review token. The caller stores `lookup` + `hash`;
 * the raw token is emailed once and cannot be reconstructed from the DB.
 */
export function mintReviewToken(): ReviewTokenMaterial {
  const raw = crypto.randomBytes(RAW_TOKEN_BYTES).toString("base64url");
  const lookup = raw.slice(0, LOOKUP_PREFIX_LENGTH);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, lookup, hash };
}

/**
 * Compare a candidate raw token to a stored hash in constant time. Returns
 * false on length mismatch (also constant time, just to avoid crypto throws).
 */
export function verifyReviewToken(raw: string, storedHash: string): boolean {
  if (!raw || !storedHash) return false;
  const candidate = crypto.createHash("sha256").update(raw).digest("hex");
  const a = Buffer.from(candidate, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Extract the lookup prefix from a raw token without verifying it. Useful
 * for narrowing the Mongo query before the constant-time compare.
 */
export function tokenLookupPrefix(raw: string): string {
  return (raw || "").slice(0, LOOKUP_PREFIX_LENGTH);
}

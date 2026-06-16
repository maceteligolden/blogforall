import crypto from "crypto";

/** Opaque workspace identifier for SDK / public API (not Mongo _id). */
export function generateSitePublicId(): string {
  return `bfws_${crypto.randomBytes(18).toString("base64url")}`;
}

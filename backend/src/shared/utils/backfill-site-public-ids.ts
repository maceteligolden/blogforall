import Site from "../schemas/site.schema";
import { generateSitePublicId } from "./site-public-id";
import { logger } from "./logger";

/** Assign public_id to any Site documents missing it (no backward-compat for API keys). */
export async function backfillSitePublicIds(): Promise<void> {
  const missing = await Site.find({
    $or: [{ public_id: { $exists: false } }, { public_id: null }, { public_id: "" }],
  }).select("_id");

  if (missing.length === 0) {
    return;
  }

  for (const doc of missing) {
    const id = doc._id!.toString();
    let public_id = generateSitePublicId();
    for (let i = 0; i < 8; i++) {
      const taken = await Site.exists({ public_id, _id: { $ne: id } });
      if (!taken) break;
      public_id = generateSitePublicId();
    }
    await Site.updateOne({ _id: doc._id }, { $set: { public_id } });
  }

  logger.info(`Backfilled public_id on ${missing.length} site(s)`, {}, "backfillSitePublicIds");
}

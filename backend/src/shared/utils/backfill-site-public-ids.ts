import { logger } from "./logger";

/** No-op: Postgres sites.public_id is required at insert time. */
export async function backfillSitePublicIds(): Promise<void> {
  logger.info("Site public_id backfill skipped (Postgres requires public_id on create)", {}, "backfillSitePublicIds");
}

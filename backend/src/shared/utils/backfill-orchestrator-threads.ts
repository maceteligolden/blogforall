import { logger } from "./logger";
import OrchestratorThreadModel from "../schemas/orchestrator-thread.schema";
import { OrchestratorThreadRepository } from "../../modules/orchestrator/repositories/orchestrator-thread.repository";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/**
 * Copy Mongo OrchestratorThread docs into Postgres, preserving `_id` strings
 * so messages, approvals, and LangGraph thread keys keep working.
 * Legacy Mongo ObjectId site/user ids are skipped — they cannot land in UUID columns.
 */
export async function backfillOrchestratorThreads(repo: OrchestratorThreadRepository): Promise<number> {
  const docs = await OrchestratorThreadModel.find({}).lean();
  let migrated = 0;
  let skipped = 0;
  for (const doc of docs) {
    const id = String(doc._id ?? "");
    const siteId = String(doc.site_id ?? "");
    const userId = String(doc.user_id ?? "");
    if (!id || !isUuid(siteId) || !isUuid(userId)) {
      skipped += 1;
      continue;
    }
    try {
      const found = await repo.findById(id, siteId);
      if (found) continue;
      await repo.create({
        id,
        site_id: siteId,
        user_id: userId,
        title: doc.title || "New conversation",
        title_source: doc.title_source || "default",
        is_onboarding: !!doc.is_onboarding,
        focus: doc.focus,
      });
      if (doc.status === "archived") {
        await repo.archive(id, siteId);
      }
      migrated += 1;
    } catch (err) {
      skipped += 1;
      logger.warn(
        "Skipped orchestrator thread backfill row",
        { id, siteId, error: (err as Error).message },
        "backfillOrchestratorThreads"
      );
    }
  }
  if (migrated || skipped) {
    logger.info(
      "Orchestrator thread backfill finished",
      { migrated, skipped, total: docs.length },
      "backfillOrchestratorThreads"
    );
  }
  return migrated;
}

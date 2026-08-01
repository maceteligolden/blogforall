import { injectable } from "tsyringe";
import MemoryRecordModel, {
  type MemoryRecordEntity,
  type MemoryRecordLayer,
} from "../../../shared/schemas/memory-record.schema";
import { memoryRecordSchema, type MemoryRecord } from "../ai/contracts/memory-record";

@injectable()
export class MemoryRecordRepository {
  async upsert(record: MemoryRecord): Promise<MemoryRecord> {
    const parsed = memoryRecordSchema.parse(record);
    const now = new Date().toISOString();
    const existing = await MemoryRecordModel.findOne({
      workspace_id: parsed.workspace_id,
      layer: parsed.layer,
      canonical_key: parsed.canonical_key,
      user_id: parsed.user_id ?? null,
    });

    if (existing && !existing.metadata.soft_deleted) {
      const nextVersion = existing.metadata.version + 1;
      existing.value = parsed.value;
      existing.value_text = parsed.value_text;
      existing.metadata = {
        ...parsed.metadata,
        created_at: existing.metadata.created_at,
        updated_at: now,
        version: nextVersion,
        soft_deleted: false,
      };
      existing.record_id = existing.record_id || parsed.id;
      await existing.save();
      return this.toContract(existing);
    }

    const doc = await MemoryRecordModel.findOneAndUpdate(
      {
        workspace_id: parsed.workspace_id,
        layer: parsed.layer,
        canonical_key: parsed.canonical_key,
        user_id: parsed.user_id ?? null,
      },
      {
        record_id: parsed.id,
        workspace_id: parsed.workspace_id,
        user_id: parsed.user_id ?? null,
        layer: parsed.layer,
        canonical_key: parsed.canonical_key,
        value: parsed.value,
        value_text: parsed.value_text,
        metadata: {
          ...parsed.metadata,
          created_at: parsed.metadata.created_at || now,
          updated_at: now,
          soft_deleted: false,
          version: 1,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return this.toContract(doc);
  }

  async getByKey(
    workspaceId: string,
    layer: MemoryRecordLayer,
    canonicalKey: string,
    userId?: string | null
  ): Promise<MemoryRecord | null> {
    const doc = await MemoryRecordModel.findOne({
      workspace_id: workspaceId,
      layer,
      canonical_key: canonicalKey,
      user_id: userId ?? null,
      "metadata.soft_deleted": { $ne: true },
    });
    return doc ? this.toContract(doc) : null;
  }

  async findById(workspaceId: string, recordId: string): Promise<MemoryRecord | null> {
    const doc = await MemoryRecordModel.findOne({
      workspace_id: workspaceId,
      record_id: recordId,
      "metadata.soft_deleted": { $ne: true },
    });
    return doc ? this.toContract(doc) : null;
  }

  async listByLayer(
    workspaceId: string,
    layer: MemoryRecordLayer,
    opts?: { userId?: string; limit?: number }
  ): Promise<MemoryRecord[]> {
    const filter: Record<string, unknown> = {
      workspace_id: workspaceId,
      layer,
      "metadata.soft_deleted": { $ne: true },
    };
    if (opts?.userId) filter.user_id = opts.userId;
    const docs = await MemoryRecordModel.find(filter)
      .sort({ "metadata.updated_at": -1 })
      .limit(opts?.limit ?? 50);
    return docs.map((d) => this.toContract(d));
  }

  async softDelete(workspaceId: string, recordId: string): Promise<boolean> {
    const doc = await MemoryRecordModel.findOne({
      workspace_id: workspaceId,
      record_id: recordId,
    });
    if (!doc) return false;
    doc.metadata.soft_deleted = true;
    doc.metadata.updated_at = new Date().toISOString();
    await doc.save();
    return true;
  }

  private toContract(doc: MemoryRecordEntity): MemoryRecord {
    return memoryRecordSchema.parse({
      id: doc.record_id,
      workspace_id: doc.workspace_id,
      user_id: doc.user_id,
      layer: doc.layer,
      canonical_key: doc.canonical_key,
      value: doc.value,
      value_text: doc.value_text,
      metadata: doc.metadata,
    });
  }
}

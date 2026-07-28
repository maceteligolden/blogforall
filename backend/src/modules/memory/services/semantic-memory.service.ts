import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import MemoryChunkMetaModel from "../../../shared/schemas/memory-chunk-meta.schema";
import KnowledgeChunkModel from "../../../shared/schemas/knowledge-chunk.schema";
import type { MemoryChunkSourceType } from "../../../shared/schemas/memory-types";
import { env } from "../../../shared/config/env";
import { EmbeddingService } from "./embedding.service";
import { logger } from "../../../shared/utils/logger";

export interface SemanticSearchResult {
  chunk_id: string;
  text: string;
  source_type: MemoryChunkSourceType | "knowledge_doc";
  source_id: string;
  score: number;
}

@injectable()
export class SemanticMemoryService {
  constructor(private readonly embeddingService: EmbeddingService) {}

  async storeChunk(input: {
    siteId: string;
    sourceType: MemoryChunkSourceType;
    sourceId: string;
    text: string;
    importanceScore?: number;
    expiresAt?: Date;
  }): Promise<string> {
    const chunkId = randomUUID();
    const text = input.text.trim().slice(0, 8000);
    if (!text) return chunkId;

    const embedding = await this.embeddingService.embedOne(text);
    await MemoryChunkMetaModel.create({
      site_id: input.siteId,
      chunk_id: chunkId,
      source_type: input.sourceType,
      source_id: input.sourceId,
      text_preview: text.slice(0, 500),
      text_full: text,
      embedding_model: env.memory.embeddingModel,
      embedding: embedding.length ? embedding : undefined,
      importance_score: input.importanceScore ?? 0.5,
      created_at: new Date(),
      expires_at: input.expiresAt,
    });

    await this.syncQdrantPoint(chunkId, input.siteId, text, embedding, {
      source_type: input.sourceType,
      source_id: input.sourceId,
      importance_score: input.importanceScore ?? 0.5,
    });

    return chunkId;
  }

  async search(input: {
    siteId: string;
    query: string;
    limit?: number;
    sourceTypes?: MemoryChunkSourceType[];
    minScore?: number;
  }): Promise<SemanticSearchResult[]> {
    const limit = input.limit ?? 8;
    const queryVec = await this.embeddingService.embedOne(input.query);
    const results: SemanticSearchResult[] = [];

    if (queryVec.length && env.memory.qdrantUrl) {
      const qdrantHits = await this.searchQdrant(input.siteId, queryVec, limit, input.sourceTypes);
      results.push(...qdrantHits);
    }

    if (results.length < limit) {
      const mongoHits = await this.searchMongoFallback(
        input.siteId,
        queryVec,
        limit - results.length,
        input.sourceTypes
      );
      for (const hit of mongoHits) {
        if (!results.some((r) => r.chunk_id === hit.chunk_id)) {
          results.push(hit);
        }
      }
    }

    const minScore = input.minScore ?? env.memory.minImportanceScore;
    return results
      .filter((r) => r.score >= minScore)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  async searchKnowledgeChunks(
    siteId: string,
    query: string,
    limit = 6
  ): Promise<
    Array<
      SemanticSearchResult & {
        priority?: "pinned" | "brand_guide" | "misc";
        created_at?: Date;
      }
    >
  > {
    const queryVec = await this.embeddingService.embedOne(query);
    const chunks = await KnowledgeChunkModel.find({ site_id: siteId }).select("+embedding").lean();
    if (!chunks.length) return [];

    const scored = chunks
      .map((c) => {
        const emb = (c as { embedding?: number[] }).embedding ?? [];
        const score = queryVec.length && emb.length ? this.embeddingService.cosineSimilarity(queryVec, emb) : 0.3;
        return {
          chunk_id: c._id?.toString() ?? c.source_id,
          text: c.text,
          source_type: "knowledge_doc" as const,
          source_id: c.source_id,
          score,
          priority: (c as { priority?: "pinned" | "brand_guide" | "misc" }).priority,
          created_at: c.created_at,
        };
      })
      .sort((a, b) => b.score - a.score);

    return scored.slice(0, limit);
  }

  private async searchMongoFallback(
    siteId: string,
    queryVec: number[],
    limit: number,
    sourceTypes?: MemoryChunkSourceType[]
  ): Promise<SemanticSearchResult[]> {
    const filter: Record<string, unknown> = {
      site_id: siteId,
      $or: [{ expires_at: { $exists: false } }, { expires_at: { $gt: new Date() } }],
    };
    if (sourceTypes?.length) {
      filter.source_type = { $in: sourceTypes };
    }

    const docs = await MemoryChunkMetaModel.find(filter).select("+embedding").limit(200).lean();
    return docs
      .map((d) => {
        const emb = (d as { embedding?: number[] }).embedding ?? [];
        const score =
          queryVec.length && emb.length ? this.embeddingService.cosineSimilarity(queryVec, emb) : d.importance_score;
        return {
          chunk_id: d.chunk_id,
          text: d.text_full || d.text_preview,
          source_type: d.source_type,
          source_id: d.source_id,
          score,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  private async syncQdrantPoint(
    id: string,
    siteId: string,
    text: string,
    vector: number[],
    payload: Record<string, unknown>
  ): Promise<void> {
    if (!env.memory.qdrantUrl || !vector.length) return;
    try {
      const url = `${env.memory.qdrantUrl.replace(/\/$/, "")}/collections/${env.memory.qdrantCollection}/points?wait=true`;
      await fetch(url, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(env.memory.qdrantApiKey ? { "api-key": env.memory.qdrantApiKey } : {}),
        },
        body: JSON.stringify({
          points: [{ id, vector, payload: { site_id: siteId, text_preview: text.slice(0, 500), ...payload } }],
        }),
      });
    } catch (e) {
      logger.debug("Qdrant upsert skipped", { error: (e as Error).message }, "SemanticMemoryService");
    }
  }

  private async searchQdrant(
    siteId: string,
    vector: number[],
    limit: number,
    sourceTypes?: MemoryChunkSourceType[]
  ): Promise<SemanticSearchResult[]> {
    try {
      const url = `${env.memory.qdrantUrl.replace(/\/$/, "")}/collections/${env.memory.qdrantCollection}/points/search`;
      const filter =
        sourceTypes && sourceTypes.length
          ? {
              must: [
                { key: "site_id", match: { value: siteId } },
                { key: "source_type", match: { any: sourceTypes } },
              ],
            }
          : { must: [{ key: "site_id", match: { value: siteId } }] };

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env.memory.qdrantApiKey ? { "api-key": env.memory.qdrantApiKey } : {}),
        },
        body: JSON.stringify({ vector, limit, with_payload: true, filter }),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as {
        result?: Array<{ id: string; score: number; payload?: Record<string, string> }>;
      };
      return (data.result ?? []).map((r) => ({
        chunk_id: String(r.id),
        text: r.payload?.text_preview ?? "",
        source_type: (r.payload?.source_type as MemoryChunkSourceType) ?? "conversation",
        source_id: r.payload?.source_id ?? "",
        score: r.score,
      }));
    } catch {
      return [];
    }
  }
}

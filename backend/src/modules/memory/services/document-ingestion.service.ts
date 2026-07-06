import { injectable } from "tsyringe";
import KnowledgeChunkModel from "../../../shared/schemas/knowledge-chunk.schema";
import { EmbeddingService } from "./embedding.service";
import { env } from "../../../shared/config/env";

@injectable()
export class DocumentIngestionService {
  constructor(private readonly embeddingService: EmbeddingService) {}

  chunkText(text: string): string[] {
    const chunkSize = env.memory.chunkSize;
    const overlap = env.memory.chunkOverlap;
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= chunkSize) return [text.trim()].filter(Boolean);

    const chunks: string[] = [];
    let start = 0;
    while (start < words.length) {
      const slice = words.slice(start, start + chunkSize).join(" ");
      if (slice.trim()) chunks.push(slice.trim());
      if (start + chunkSize >= words.length) break;
      start += chunkSize - overlap;
    }
    return chunks;
  }

  async ingestKnowledgeSource(siteId: string, sourceId: string, fullText: string): Promise<number> {
    const chunks = this.chunkText(fullText);
    if (!chunks.length) return 0;

    await KnowledgeChunkModel.deleteMany({ site_id: siteId, source_id: sourceId });
    const embeddings = await this.embeddingService.embed(chunks);

    const docs = chunks.map((text, idx) => ({
      site_id: siteId,
      source_id: sourceId,
      chunk_index: idx,
      text,
      token_count: Math.ceil(text.split(/\s+/).length * 1.3),
      embedding: embeddings[idx]?.length ? embeddings[idx] : undefined,
      created_at: new Date(),
    }));

    await KnowledgeChunkModel.insertMany(docs);
    return docs.length;
  }
}

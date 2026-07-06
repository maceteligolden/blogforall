import { injectable } from "tsyringe";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";

@injectable()
export class EmbeddingService {
  private readonly model = env.memory.embeddingModel;

  async embed(texts: string[]): Promise<number[][]> {
    const apiKey = env.orchestrator.openaiApiKey;
    if (!apiKey || texts.length === 0) {
      return texts.map(() => []);
    }

    const inputs = texts.map((t) => t.slice(0, 8000));
    try {
      const res = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: this.model, input: inputs }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        logger.warn("Embedding API failed", { status: res.status, body: body.slice(0, 200) }, "EmbeddingService");
        return texts.map(() => []);
      }
      const data = (await res.json()) as { data?: Array<{ embedding: number[] }> };
      return (data.data ?? []).map((d) => d.embedding ?? []);
    } catch (e) {
      logger.warn("Embedding error", { error: (e as Error).message }, "EmbeddingService");
      return texts.map(() => []);
    }
  }

  async embedOne(text: string): Promise<number[]> {
    const [vec] = await this.embed([text]);
    return vec ?? [];
  }

  cosineSimilarity(a: number[], b: number[]): number {
    if (!a.length || a.length !== b.length) return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}

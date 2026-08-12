import {
  LongTermMemory,
  longTermMemorySchema,
  MemoryCandidate,
  MemoryMutationResult,
  memoryMutationSchema,
} from "./orchestrator.validation";
import { injectable } from "tsyringe";
import { ChatOpenAI } from "@langchain/openai";
import { MEMORY_RECONCILIATION_PROMPT } from "./prompts";
import { BaseMessage, HumanMessage, SystemMessage } from "langchain";
import { AGENT_MODEL } from "./orchestrator.constants";
import OrchestratorLongTermMemoryModel, {
  type OrchestratorLongTermMemoryDoc,
} from "../../shared/schemas/orchestrator-longterm-memory.schema";
import { EmbeddingService } from "../memory/services/embedding.service";
import { env } from "../../shared/config/env";

type MemoryProcessState = {
  messages: BaseMessage[];
};

const SEARCH_CANDIDATE_CAP = 200;

@injectable()
export class LangChainMemoryRepository {
  constructor(private readonly embeddingService: EmbeddingService) {}

  async search(
    query: string,
    userId: string,
    siteId: string,
    limit = 10,
  ): Promise<LongTermMemory[]> {
    const trimmed = query.trim();
    if (!trimmed) {
      return this.list(userId, siteId, limit);
    }

    const queryVec = await this.embeddingService.embedOne(trimmed);
    if (!queryVec.length) {
      return this.listByImportance(userId, siteId, limit);
    }

    const docs = await OrchestratorLongTermMemoryModel.find({
      siteId,
      userId,
    })
      .select("+embedding")
      .limit(SEARCH_CANDIDATE_CAP)
      .lean();

    const scored: Array<{
      doc: (typeof docs)[number];
      finalScore: number;
    }> = [];

    for (const doc of docs) {
      const emb = doc.embedding ?? [];
      if (!emb.length) {
        continue;
      }
      const similarity = this.embeddingService.cosineSimilarity(queryVec, emb);
      const importance = doc.importance ?? 0.5;
      scored.push({
        doc,
        finalScore: similarity * 0.85 + importance * 0.15,
      });
    }

    scored.sort((a, b) => b.finalScore - a.finalScore);

    return scored
      .slice(0, limit)
      .map(({ doc }) => this.parseDoc(doc))
      .filter((memory): memory is LongTermMemory => memory != null);
  }

  async list(
    userId: string,
    siteId: string,
    limit = 40,
  ): Promise<LongTermMemory[]> {
    const docs = await OrchestratorLongTermMemoryModel.find({
      siteId,
      userId,
    })
      .sort({ updatedAt: -1 })
      .limit(limit)
      .lean();

    return docs
      .map((doc) => this.parseDoc(doc))
      .filter((memory): memory is LongTermMemory => memory != null);
  }

  async save(memory: LongTermMemory): Promise<void> {
    const embedding = await this.embeddingService.embedOne(memory.content);
    const payload = this.toDocPayload(memory, embedding);

    // Avoid wiping a prior embedding if the embed API fails for this write.
    if (!embedding.length) {
      delete payload.embedding;
    }

    await OrchestratorLongTermMemoryModel.findOneAndUpdate(
      { id: memory.id, siteId: memory.siteId, userId: memory.userId },
      { $set: payload },
      { upsert: true, new: true },
    );
  }

  async update(memory: LongTermMemory): Promise<void> {
    await this.save(memory);
  }

  async delete(
    userId: string,
    siteId: string,
    memoryId: string,
  ): Promise<void> {
    await OrchestratorLongTermMemoryModel.deleteOne({
      id: memoryId,
      siteId,
      userId,
    });
  }

  async processMemoryData(
    state: MemoryProcessState,
    userId: string,
    siteId: string,
  ): Promise<void> {
    const existing = await this.list(userId, siteId, 40);
    const existingById = new Map(existing.map((memory) => [memory.id, memory]));

    const model = new ChatOpenAI({ model: AGENT_MODEL });
    const result = await model
      .withStructuredOutput(memoryMutationSchema)
      .invoke([
        new SystemMessage(MEMORY_RECONCILIATION_PROMPT),
        new HumanMessage(
          `Existing memories (JSON):\n${JSON.stringify(
            existing.map((memory) => ({
              id: memory.id,
              type: memory.type,
              content: memory.content,
              importance: memory.importance,
              ...(memory.type === "semantic" || memory.type === "procedural"
                ? { category: memory.category }
                : {}),
              ...(memory.type === "episodic"
                ? { eventType: memory.eventType }
                : {}),
            })),
            null,
            2,
          )}`,
        ),
        ...state.messages,
      ]);

    await this.applyMutations(result, existingById, userId, siteId);
  }

  private async listByImportance(
    userId: string,
    siteId: string,
    limit: number,
  ): Promise<LongTermMemory[]> {
    const docs = await OrchestratorLongTermMemoryModel.find({
      siteId,
      userId,
    })
      .sort({ importance: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    return docs
      .map((doc) => this.parseDoc(doc))
      .filter((memory): memory is LongTermMemory => memory != null);
  }

  private async applyMutations(
    result: MemoryMutationResult,
    existingById: Map<string, LongTermMemory>,
    userId: string,
    siteId: string,
  ): Promise<void> {
    for (const mutation of result.mutations) {
      if (mutation.action === "add") {
        await this.save(this.createMemory(mutation.memory, userId, siteId));
        continue;
      }

      if (mutation.action === "forget") {
        if (!existingById.has(mutation.id)) {
          continue;
        }
        await this.delete(userId, siteId, mutation.id);
        existingById.delete(mutation.id);
        continue;
      }

      const current = existingById.get(mutation.id);
      if (!current) {
        continue;
      }

      const updated = this.applyUpdate(current, mutation);
      await this.update(updated);
      existingById.set(updated.id, updated);
    }
  }

  private applyUpdate(
    current: LongTermMemory,
    mutation: Extract<
      MemoryMutationResult["mutations"][number],
      { action: "update" }
    >,
  ): LongTermMemory {
    const now = new Date();
    const content = mutation.content ?? current.content;
    const importance = mutation.importance ?? current.importance;

    if (current.type === "semantic") {
      const category =
        mutation.category != null
          ? (mutation.category as typeof current.category)
          : current.category;
      return {
        ...current,
        content,
        importance,
        category,
        updatedAt: now,
      };
    }

    if (current.type === "procedural") {
      const category =
        mutation.category != null
          ? (mutation.category as typeof current.category)
          : current.category;
      return {
        ...current,
        content,
        importance,
        category,
        updatedAt: now,
      };
    }

    return {
      ...current,
      content,
      importance,
      eventType: mutation.eventType ?? current.eventType,
      updatedAt: now,
    };
  }

  private createMemory(
    candidate: MemoryCandidate,
    userId: string,
    siteId: string,
  ): LongTermMemory {
    const now = new Date();

    switch (candidate.type) {
      case "semantic":
        return {
          id: crypto.randomUUID(),
          userId,
          siteId,
          type: "semantic",
          content: candidate.content,
          category: candidate.category,
          importance: candidate.importance,
          createdAt: now,
          updatedAt: now,
        };

      case "episodic":
        return {
          id: crypto.randomUUID(),
          userId,
          siteId,
          type: "episodic",
          content: candidate.content,
          eventType: candidate.eventType,
          importance: candidate.importance,
          occurredAt: now,
          createdAt: now,
          updatedAt: now,
        };

      case "procedural":
        return {
          id: crypto.randomUUID(),
          userId,
          siteId,
          type: "procedural",
          content: candidate.content,
          category: candidate.category,
          importance: candidate.importance,
          createdAt: now,
          updatedAt: now,
        };
    }
  }

  private toDocPayload(
    memory: LongTermMemory,
    embedding: number[],
  ): Partial<OrchestratorLongTermMemoryDoc> {
    const base: Partial<OrchestratorLongTermMemoryDoc> = {
      id: memory.id,
      userId: memory.userId,
      siteId: memory.siteId,
      type: memory.type,
      content: memory.content,
      importance: memory.importance,
      source: memory.source,
      embedding_model: env.memory.embeddingModel,
      createdAt: memory.createdAt,
      updatedAt: memory.updatedAt,
    };

    if (embedding.length) {
      base.embedding = embedding;
    }

    if (memory.type === "semantic" || memory.type === "procedural") {
      base.category = memory.category;
    }

    if (memory.type === "episodic") {
      base.eventType = memory.eventType;
      base.occurredAt = memory.occurredAt;
    }

    return base;
  }

  private parseDoc(
    doc: OrchestratorLongTermMemoryDoc | Record<string, unknown>,
  ): LongTermMemory | null {
    const parsed = longTermMemorySchema.safeParse({
      id: doc.id,
      userId: doc.userId,
      siteId: doc.siteId,
      type: doc.type,
      content: doc.content,
      importance: doc.importance,
      category: doc.category,
      eventType: doc.eventType,
      occurredAt: doc.occurredAt,
      source: doc.source,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    });
    return parsed.success ? parsed.data : null;
  }
}

import { createHash } from "crypto";
import { injectable } from "tsyringe";
import { getThreadKvStore, ThreadKvStore } from "./thread-kv.store";

const LIST_TTL_SECONDS = 60;
const MESSAGES_TTL_SECONDS = 120;

@injectable()
export class ThreadCacheService {
  constructor(private readonly kv: ThreadKvStore = getThreadKvStore()) {}

  listKey(siteId: string, filterHash = ""): string {
    return filterHash ? `thread:list:${siteId}:${filterHash}` : `thread:list:${siteId}`;
  }

  messagesKey(siteId: string, threadId: string): string {
    return `thread:messages:${siteId}:${threadId}`;
  }

  hashFilters(filters: Record<string, unknown>): string {
    const stable = JSON.stringify(filters, Object.keys(filters).sort());
    return createHash("sha1").update(stable).digest("hex").slice(0, 12);
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.kv.get(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.kv.set(key, JSON.stringify(value), ttlSeconds);
  }

  async getList<T>(siteId: string, filters?: Record<string, unknown>): Promise<T | null> {
    const hash = filters && Object.keys(filters).length ? this.hashFilters(filters) : "";
    return this.getJson<T>(this.listKey(siteId, hash));
  }

  async setList(siteId: string, value: unknown, filters?: Record<string, unknown>): Promise<void> {
    const hash = filters && Object.keys(filters).length ? this.hashFilters(filters) : "";
    await this.setJson(this.listKey(siteId, hash), value, LIST_TTL_SECONDS);
  }

  async getMessages<T>(siteId: string, threadId: string): Promise<T | null> {
    return this.getJson<T>(this.messagesKey(siteId, threadId));
  }

  async setMessages(siteId: string, threadId: string, value: unknown): Promise<void> {
    await this.setJson(this.messagesKey(siteId, threadId), value, MESSAGES_TTL_SECONDS);
  }

  async invalidateSite(siteId: string): Promise<void> {
    await this.kv.delByPrefix(`thread:list:${siteId}`);
  }

  async invalidateThread(siteId: string, threadId: string): Promise<void> {
    await Promise.all([this.invalidateSite(siteId), this.kv.del(this.messagesKey(siteId, threadId))]);
  }
}

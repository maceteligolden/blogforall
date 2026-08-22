import Redis from "ioredis";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";

type MemoryEntry = { value: string; expiresAt: number };

/**
 * Tiny key-value store used for thread list/message cache and write leases.
 * Redis when REDIS_URL is set; otherwise an in-process Map with the same TTLs.
 */
export class ThreadKvStore {
  private redis: Redis | null = null;
  private readonly memory = new Map<string, MemoryEntry>();

  constructor() {
    const url = env.notification.redisUrl;
    if (url) {
      try {
        this.redis = new Redis(url, {
          maxRetriesPerRequest: 1,
          enableReadyCheck: false,
          lazyConnect: true,
        });
        this.redis.connect().catch((err) => {
          logger.warn(
            "Thread KV Redis connect failed; using memory",
            { error: (err as Error).message },
            "ThreadKvStore"
          );
          this.redis = null;
        });
      } catch (err) {
        logger.warn("Thread KV Redis init failed; using memory", { error: (err as Error).message }, "ThreadKvStore");
        this.redis = null;
      }
    }
  }

  async get(key: string): Promise<string | null> {
    try {
      if (this.redis) {
        return await this.redis.get(key);
      }
    } catch (err) {
      logger.warn("Thread KV get failed", { key, error: (err as Error).message }, "ThreadKvStore");
    }
    this.pruneMemory();
    const row = this.memory.get(key);
    if (!row) return null;
    if (row.expiresAt <= Date.now()) {
      this.memory.delete(key);
      return null;
    }
    return row.value;
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.set(key, value, "EX", ttlSeconds);
        return;
      }
    } catch (err) {
      logger.warn("Thread KV set failed", { key, error: (err as Error).message }, "ThreadKvStore");
    }
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  async del(key: string): Promise<void> {
    try {
      if (this.redis) {
        await this.redis.del(key);
      }
    } catch (err) {
      logger.warn("Thread KV del failed", { key, error: (err as Error).message }, "ThreadKvStore");
    }
    this.memory.delete(key);
  }

  async delByPrefix(prefix: string): Promise<void> {
    try {
      if (this.redis) {
        const keys = await this.redis.keys(`${prefix}*`);
        if (keys.length) await this.redis.del(...keys);
      }
    } catch (err) {
      logger.warn("Thread KV delByPrefix failed", { prefix, error: (err as Error).message }, "ThreadKvStore");
    }
    for (const key of this.memory.keys()) {
      if (key.startsWith(prefix)) this.memory.delete(key);
    }
  }

  async setNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
    try {
      if (this.redis) {
        const result = await this.redis.set(key, value, "EX", ttlSeconds, "NX");
        return result === "OK";
      }
    } catch (err) {
      logger.warn("Thread KV setNx failed", { key, error: (err as Error).message }, "ThreadKvStore");
    }
    this.pruneMemory();
    const existing = this.memory.get(key);
    if (existing && existing.expiresAt > Date.now()) return false;
    this.memory.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    return true;
  }

  private pruneMemory(): void {
    const now = Date.now();
    for (const [key, row] of this.memory) {
      if (row.expiresAt <= now) this.memory.delete(key);
    }
  }
}

let sharedStore: ThreadKvStore | null = null;

export function getThreadKvStore(): ThreadKvStore {
  if (!sharedStore) sharedStore = new ThreadKvStore();
  return sharedStore;
}

export function resetThreadKvStoreForTests(): void {
  sharedStore = new ThreadKvStore();
}

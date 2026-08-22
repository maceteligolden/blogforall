import { injectable } from "tsyringe";
import { getThreadKvStore, ThreadKvStore } from "./thread-kv.store";

export type ThreadLockHolder = { user_id: string; name: string; acquired_at: string };

const LOCK_TTL_SECONDS = 90;

@injectable()
export class ThreadWriteLockService {
  constructor(private readonly kv: ThreadKvStore = getThreadKvStore()) {}

  private key(siteId: string, threadId: string): string {
    return `thread:lock:${siteId}:${threadId}`;
  }

  async peek(siteId: string, threadId: string): Promise<ThreadLockHolder | null> {
    const raw = await this.kv.get(this.key(siteId, threadId));
    return this.parse(raw);
  }

  /**
   * Acquire or refresh a per-thread write lease. Same user may re-enter.
   * Returns the holder when another member already holds the lock.
   */
  async acquire(
    siteId: string,
    threadId: string,
    userId: string,
    name: string
  ): Promise<{ ok: true } | { ok: false; holder: ThreadLockHolder }> {
    const key = this.key(siteId, threadId);
    const holder: ThreadLockHolder = {
      user_id: userId,
      name: name.trim() || "A teammate",
      acquired_at: new Date().toISOString(),
    };
    const created = await this.kv.setNx(key, JSON.stringify(holder), LOCK_TTL_SECONDS);
    if (created) return { ok: true };

    const existing = await this.peek(siteId, threadId);
    if (!existing || existing.user_id === userId) {
      await this.kv.set(key, JSON.stringify(existing ?? holder), LOCK_TTL_SECONDS);
      return { ok: true };
    }
    return { ok: false, holder: existing };
  }

  async refresh(siteId: string, threadId: string, userId: string): Promise<void> {
    const existing = await this.peek(siteId, threadId);
    if (!existing || existing.user_id !== userId) return;
    await this.kv.set(this.key(siteId, threadId), JSON.stringify(existing), LOCK_TTL_SECONDS);
  }

  async release(siteId: string, threadId: string, userId: string): Promise<void> {
    const existing = await this.peek(siteId, threadId);
    if (!existing || existing.user_id !== userId) return;
    await this.kv.del(this.key(siteId, threadId));
  }

  private parse(raw: string | null): ThreadLockHolder | null {
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as ThreadLockHolder;
      if (!parsed?.user_id) return null;
      return parsed;
    } catch {
      return null;
    }
  }
}

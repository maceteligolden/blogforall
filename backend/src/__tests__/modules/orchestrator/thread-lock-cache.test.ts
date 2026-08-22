import { ThreadKvStore } from "../../../modules/orchestrator/services/thread-kv.store";
import { ThreadWriteLockService } from "../../../modules/orchestrator/services/thread-write-lock.service";
import { ThreadCacheService } from "../../../modules/orchestrator/services/thread-cache.service";

describe("thread write lock", () => {
  it("lets the same user re-enter and blocks another member", async () => {
    const kv = new ThreadKvStore();
    const locks = new ThreadWriteLockService(kv);
    const first = await locks.acquire("site", "thread", "u1", "Ada");
    expect(first).toEqual({ ok: true });
    const again = await locks.acquire("site", "thread", "u1", "Ada");
    expect(again).toEqual({ ok: true });
    const other = await locks.acquire("site", "thread", "u2", "Bob");
    expect(other.ok).toBe(false);
    if (!other.ok) {
      expect(other.holder.user_id).toBe("u1");
      expect(other.holder.name).toBe("Ada");
    }
    await locks.release("site", "thread", "u1");
    const after = await locks.acquire("site", "thread", "u2", "Bob");
    expect(after).toEqual({ ok: true });
  });
});

describe("thread cache read-through / write-through", () => {
  it("stores list and message payloads and invalidates on write", async () => {
    const kv = new ThreadKvStore();
    const cache = new ThreadCacheService(kv);
    await cache.setList("site", { threads: [{ _id: "t1" }] });
    await expect(cache.getList("site")).resolves.toEqual({ threads: [{ _id: "t1" }] });
    await cache.setMessages("site", "t1", { thread: { _id: "t1" }, messages: [] });
    await expect(cache.getMessages("site", "t1")).resolves.toEqual({ thread: { _id: "t1" }, messages: [] });
    await cache.invalidateThread("site", "t1");
    await expect(cache.getList("site")).resolves.toBeNull();
    await expect(cache.getMessages("site", "t1")).resolves.toBeNull();
  });
});

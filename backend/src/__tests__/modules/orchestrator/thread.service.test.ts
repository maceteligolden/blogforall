import { ForbiddenError } from "../../../shared/errors";
import { SiteMemberRole } from "../../../shared/constants";
import { ThreadService } from "../../../modules/orchestrator/services/thread.service";
import { listNextDueTopics } from "../../../modules/orchestratorv2/orchestrator.next-due";

jest.mock("../../../modules/orchestratorv2/orchestrator.next-due", () => ({
  listNextDueTopics: jest.fn(async () => []),
}));

describe("ThreadService", () => {
  const siteId = "site-1";
  const creatorId = "user-creator";
  const viewerId = "user-viewer";

  beforeEach(() => {
    (listNextDueTopics as jest.Mock).mockReset();
    (listNextDueTopics as jest.Mock).mockResolvedValue([]);
  });

  function build(overrides?: {
    existingBlogThread?: { _id: string } | null;
    existingSequenceThread?: { _id: string; focus?: Record<string, unknown> } | null;
    thread?: Record<string, unknown>;
  }) {
    const thread = {
      _id: "thread-1",
      created_by: creatorId,
      user_id: creatorId,
      site_id: siteId,
      title: "New conversation",
      associations: [],
      ...(overrides?.thread ?? {}),
    };
    const created: unknown[] = [];
    const threads = {
      findByBlogId: jest.fn(async () => overrides?.existingBlogThread ?? null),
      findByCampaignSequence: jest.fn(async () => overrides?.existingSequenceThread ?? null),
      setFocus: jest.fn(async (_id: string, _siteId: string, focus: Record<string, unknown>) => ({
        ...(overrides?.existingSequenceThread ?? thread),
        focus,
      })),
      create: jest.fn(async (input: unknown) => {
        created.push(input);
        return thread;
      }),
      listForSite: jest.fn(async () => ({ threads: [thread] })),
      findById: jest.fn(async () => thread),
      rename: jest.fn(async () => thread),
      delete: jest.fn(async () => true),
      addAssociations: jest.fn(async () => undefined),
    };
    const messages = { listByThread: jest.fn(async () => []), deleteByThread: jest.fn(async () => undefined) };
    const cache = {
      getList: jest.fn(async () => null),
      setList: jest.fn(async () => undefined),
      getMessages: jest.fn(async () => null),
      setMessages: jest.fn(async () => undefined),
      invalidateSite: jest.fn(async () => undefined),
      invalidateThread: jest.fn(async () => undefined),
    };
    const locks = { peek: jest.fn(async () => null) };
    const siteService = {
      hasSiteAccess: jest.fn(async () => true),
      getUserRole: jest.fn(async (_sid: string, uid: string) =>
        uid === viewerId ? SiteMemberRole.VIEWER : SiteMemberRole.EDITOR
      ),
    };
    const blogs = {
      findById: jest.fn(async (id: string) =>
        id === "blog-1" ? { _id: "blog-1", title: "Post A", campaign_id: "camp-1" } : null
      ),
    };
    const campaigns = {
      findById: jest.fn(async (id: string) => (id.startsWith("camp") ? { _id: id, name: "Campaign" } : null)),
    };
    const strategies = { findActive: jest.fn(async () => ({ _id: "strat-1" })) };
    const realtime = { emitToSite: jest.fn() };
    const digest = { refresh: jest.fn(async () => "") };

    const service = new ThreadService(
      threads as never,
      messages as never,
      cache as never,
      locks as never,
      siteService as never,
      blogs as never,
      campaigns as never,
      strategies as never,
      realtime as never,
      digest as never
    );
    return { service, threads, created, siteService };
  }

  it("reuses the unique post thread instead of creating a second", async () => {
    const { service, threads } = build({ existingBlogThread: { _id: "existing-post-thread" } });
    const result = await service.create({
      siteId,
      userId: creatorId,
      focus: { blog_id: "blog-1" },
    });
    expect(result._id).toBe("existing-post-thread");
    expect(threads.create).not.toHaveBeenCalled();
  });

  it("reuses the thread for the same campaign roadmap item", async () => {
    const { service, threads } = build({
      existingSequenceThread: {
        _id: "topic-thread",
        focus: { campaign_id: "camp-1", roadmap_sequence_index: 2, topic: "Old title" },
      },
    });
    const result = await service.create({
      siteId,
      userId: creatorId,
      focus: { campaign_id: "camp-1", roadmap_sequence_index: 2, topic: "Old title", blog_id: "blog-1" },
    });
    expect(result._id).toBe("topic-thread");
    expect(threads.create).not.toHaveBeenCalled();
    expect(threads.setFocus).toHaveBeenCalledWith(
      "topic-thread",
      siteId,
      expect.objectContaining({ campaign_id: "camp-1", roadmap_sequence_index: 2, blog_id: "blog-1" })
    );
  });

  it("binds the next due topic when writing focus is empty", async () => {
    (listNextDueTopics as jest.Mock).mockResolvedValueOnce([
      {
        campaign_id: "camp-1",
        campaign_name: "Evergreen",
        sequence_index: 0,
        title: "First post",
        objective: "Publish",
        strategic_intent: "Grow traffic",
        overdue: true,
      },
    ]);
    const { service, created } = build();
    await service.create({ siteId, userId: creatorId, focus: {} });
    const input = created[0] as {
      focus: { campaign_id?: string; roadmap_sequence_index?: number; topic?: string };
      associations: Array<{ entity_type: string; entity_id: string }>;
      is_onboarding?: boolean;
    };
    expect(input.focus).toEqual(
      expect.objectContaining({
        campaign_id: "camp-1",
        roadmap_sequence_index: 0,
        topic: "First post",
      })
    );
    expect(input.associations).toEqual(
      expect.arrayContaining([
        { entity_type: "campaign", entity_id: "camp-1" },
        { entity_type: "strategy", entity_id: "strat-1" },
      ])
    );
    expect(input.is_onboarding).toBeFalsy();
    expect(listNextDueTopics).toHaveBeenCalledWith(siteId, 1);
  });

  it("does not look up next due for a generic chat with no focus", async () => {
    const { service } = build();
    await service.create({ siteId, userId: creatorId, channel: "chat" });
    expect(listNextDueTopics).not.toHaveBeenCalled();
  });

  it("links a new dashboard thread to the active strategy", async () => {
    const { service, created } = build();
    await service.create({ siteId, userId: creatorId, channel: "chat" });
    const input = created[0] as { associations: Array<{ entity_type: string; entity_id: string }> };
    expect(input.associations).toEqual(expect.arrayContaining([{ entity_type: "strategy", entity_id: "strat-1" }]));
  });

  it("lets a viewer with CHAT create and list, but not delete someone else's thread", async () => {
    const { service } = build();
    await expect(service.create({ siteId, userId: viewerId })).resolves.toBeTruthy();
    await expect(service.list(siteId, viewerId, { limit: 10 })).resolves.toEqual({ threads: expect.any(Array) });
    await expect(service.delete("thread-1", siteId, viewerId)).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("adds a second campaign association without dropping the first", async () => {
    const { service, threads } = build({
      thread: {
        associations: [{ entity_type: "campaign", entity_id: "camp-1" }],
      },
    });
    await service.updateAssociations("thread-1", siteId, creatorId, [{ entity_type: "campaign", entity_id: "camp-2" }]);
    expect(threads.addAssociations).toHaveBeenCalledWith(
      "thread-1",
      siteId,
      expect.arrayContaining([
        { entity_type: "campaign", entity_id: "camp-2" },
        { entity_type: "strategy", entity_id: "strat-1" },
      ])
    );
    const added = (threads.addAssociations as jest.Mock).mock.calls[0][2] as Array<{ entity_id: string }>;
    expect(added.some((a) => a.entity_id === "camp-1")).toBe(false);
  });
});

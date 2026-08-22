import { BadRequestError } from "../../../shared/errors";
import { ThreadOpenerService } from "../../../modules/orchestrator/services/thread-opener.service";
import { listNextDueTopics } from "../../../modules/orchestratorv2/orchestrator.next-due";

jest.mock("../../../modules/orchestratorv2/orchestrator.next-due", () => ({
  listNextDueTopics: jest.fn(async () => []),
}));

describe("ThreadOpenerService", () => {
  it("does not create a thread when thread_id is missing", async () => {
    const threads = { findById: jest.fn(), create: jest.fn() };
    const service = new ThreadOpenerService(
      threads as never,
      {} as never,
      { buildBrief: jest.fn() } as never,
      { hasSiteAccess: jest.fn(async () => true) } as never,
      {} as never
    );
    await expect(service.ensureOpener("site-1", "user-1")).rejects.toBeInstanceOf(BadRequestError);
    expect(threads.create).not.toHaveBeenCalled();
    expect(threads.findById).not.toHaveBeenCalled();
  });

  it("keeps a campaign-only focus instead of binding the next due topic", async () => {
    (listNextDueTopics as jest.Mock).mockResolvedValueOnce([
      {
        campaign_id: "camp-1",
        campaign_name: "Evergreen",
        sequence_index: 0,
        title: "First post",
        objective: "",
        strategic_intent: "Grow",
        overdue: true,
      },
    ]);
    const threads = {
      findById: jest.fn(async () => ({
        _id: "thread-1",
        focus: { campaign_id: "camp-1" },
      })),
      setFocus: jest.fn(),
      create: jest.fn(),
      touch: jest.fn(),
    };
    const messages = {
      listByThread: jest.fn(async () => []),
      create: jest.fn(async (row: { content: string }) => ({
        _id: "msg-1",
        content: row.content,
        created_at: new Date(),
      })),
    };
    const service = new ThreadOpenerService(
      threads as never,
      messages as never,
      { buildBrief: jest.fn(async () => ({ chips: [], opener_line: "Hi", priority: "welcome_back" })) } as never,
      { hasSiteAccess: jest.fn(async () => true) } as never,
      { invalidateThread: jest.fn(async () => undefined) } as never
    );
    const result = await service.ensureOpener("site-1", "user-1", "thread-1");
    expect(threads.setFocus).not.toHaveBeenCalled();
    expect(result.next_topics).toHaveLength(1);
    expect(result.assistant_message?.content).toContain("Working on Evergreen");
  });
});

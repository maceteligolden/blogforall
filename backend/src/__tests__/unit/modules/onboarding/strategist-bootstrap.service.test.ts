import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { parseContentStrategyDocument } from "../../../../shared/types/content-strategy.document";
import { REALTIME_EVENTS } from "../../../../shared/realtime/contracts/event-names";
import {
  StrategistBootstrapService,
  __resetStrategistBootstrapInflightForTests,
  getStrategistBootstrapInflight,
} from "../../../../modules/onboarding/services/strategist-bootstrap.service";

const readyDocument = parseContentStrategyDocument({
  north_star: { what_we_are: "A SaaS for writers" },
  narrative: { core_message: "Write with a strategist" },
});

const readyStrategy = {
  generation_status: "ready" as const,
  document: readyDocument,
};

describe("StrategistBootstrapService", () => {
  const emitToUser = jest.fn();
  const generateFromWebsite = jest.fn<() => Promise<typeof readyStrategy>>();
  const markFailed = jest.fn<() => Promise<unknown>>();
  const getActive = jest.fn<() => Promise<{
    generation_status: "ready" | "generating" | "failed";
    website_url?: string;
    document?: typeof readyDocument;
  } | null>>();
  const ensureDefaultCampaign = jest.fn<() => Promise<{ _id: string }>>();
  const findDefault = jest.fn<() => Promise<{ _id: string } | null>>();
  const findLatest = jest.fn<() => Promise<{ _id: string; items: Array<{ title: string }>; status: string } | null>>();
  const deleteById = jest.fn<() => Promise<boolean>>();
  const deleteByCampaign = jest.fn<() => Promise<void>>();
  const ensureDefaultRoadmap = jest.fn<() => Promise<void>>();
  const findById = jest.fn<() => Promise<{ website_url?: string } | null>>();

  let service: StrategistBootstrapService;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetStrategistBootstrapInflightForTests();
    findById.mockResolvedValue({ website_url: "https://example.com" });
    generateFromWebsite.mockResolvedValue(readyStrategy);
    markFailed.mockResolvedValue({});
    getActive.mockResolvedValue(null);
    ensureDefaultCampaign.mockResolvedValue({ _id: "c1" });
    findDefault.mockResolvedValue({ _id: "c1" });
    findLatest.mockResolvedValue({ _id: "r1", items: [{ title: "Topic A" }], status: "approved" });
    deleteById.mockResolvedValue(true);
    deleteByCampaign.mockResolvedValue(undefined);
    ensureDefaultRoadmap.mockResolvedValue(undefined);
    service = new StrategistBootstrapService(
      { findById } as never,
      { generateFromWebsite, markFailed, getActive, peekActive: getActive } as never,
      { ensureDefaultCampaign } as never,
      { findDefault } as never,
      { findLatest, deleteById } as never,
      { deleteByCampaign } as never,
      { ensureDefaultRoadmap } as never,
      { emitToUser } as never
    );
  });

  it("runs strategy, campaign, and topics then emits completed", async () => {
    getActive.mockResolvedValue(null);
    const result = await service.start("s1", "u1");
    expect(result.accepted).toBe(true);
    await getStrategistBootstrapInflight("s1");

    expect(generateFromWebsite).toHaveBeenCalledWith("s1", "u1", "https://example.com", {
      skipRoadmapBootstrap: true,
    });
    expect(ensureDefaultCampaign).toHaveBeenCalledWith("s1", "u1", { skipRoadmapBootstrap: true });
    expect(ensureDefaultRoadmap).toHaveBeenCalledWith("s1", "u1");
    expect(emitToUser).toHaveBeenCalledWith(
      "u1",
      REALTIME_EVENTS.SIGNUP_BOOTSTRAP_COMPLETED,
      { siteId: "s1" },
      { siteId: "s1" }
    );
    const stepReady = emitToUser.mock.calls.filter(
      (call) => call[1] === REALTIME_EVENTS.SIGNUP_BOOTSTRAP_STEP && (call[2] as { status: string }).status === "ready"
    );
    expect(stepReady).toHaveLength(3);
  });

  it("accepts a ready generation_status even if the hydrated document looks thin", async () => {
    generateFromWebsite.mockResolvedValue({
      generation_status: "ready",
      document: parseContentStrategyDocument({}),
    });
    await service.start("s1", "u1");
    await getStrategistBootstrapInflight("s1");
    expect(ensureDefaultCampaign).toHaveBeenCalled();
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("compensates and emits failed when strategy generation fails", async () => {
    generateFromWebsite.mockRejectedValue(new Error("scrape failed"));
    await service.start("s1", "u1");
    await getStrategistBootstrapInflight("s1");

    expect(ensureDefaultCampaign).not.toHaveBeenCalled();
    expect(ensureDefaultRoadmap).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith("s1", "u1", "scrape failed");
    expect(deleteByCampaign).toHaveBeenCalled();
    expect(emitToUser).toHaveBeenCalledWith(
      "u1",
      REALTIME_EVENTS.SIGNUP_BOOTSTRAP_FAILED,
      expect.objectContaining({ siteId: "s1", step: "content_strategy", error: "scrape failed" }),
      { siteId: "s1" }
    );
  });

  it("does not create a campaign when the website cannot be read", async () => {
    generateFromWebsite.mockRejectedValue(new Error("Could not read that website. Check the URL and try again."));
    await service.start("s1", "u1");
    await getStrategistBootstrapInflight("s1");

    expect(ensureDefaultCampaign).not.toHaveBeenCalled();
    expect(ensureDefaultRoadmap).not.toHaveBeenCalled();
    expect(markFailed).toHaveBeenCalledWith("s1", "u1", "Could not read that website. Check the URL and try again.");
  });

  it("coalesces overlapping start calls for the same site", async () => {
    let resolveGenerate: (value: typeof readyStrategy) => void = () => undefined;
    generateFromWebsite.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGenerate = resolve;
        })
    );

    const first = service.start("site-coalesce", "u1");
    const second = service.start("site-coalesce", "u1");
    const [a, b] = await Promise.all([first, second]);
    expect(a.accepted).toBe(true);
    expect(b.accepted).toBe(true);

    let spins = 0;
    while (generateFromWebsite.mock.calls.length === 0) {
      spins += 1;
      if (spins > 50) {
        throw new Error("generateFromWebsite was never called");
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(generateFromWebsite).toHaveBeenCalledTimes(1);

    resolveGenerate(readyStrategy);
    await getStrategistBootstrapInflight("site-coalesce");
    expect(ensureDefaultRoadmap).toHaveBeenCalledTimes(1);
  });

  it("starts a new run when force is set while another run is inflight", async () => {
    let resolveFirst: (value: typeof readyStrategy) => void = () => undefined;
    generateFromWebsite.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    generateFromWebsite.mockResolvedValueOnce(readyStrategy);

    const first = await service.start("site-force", "u1");
    expect(first.accepted).toBe(true);
    let spins = 0;
    while (generateFromWebsite.mock.calls.length === 0) {
      spins += 1;
      if (spins > 50) throw new Error("first generateFromWebsite was never called");
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    findById.mockResolvedValue({ website_url: "https://new.example" });
    getActive.mockResolvedValue({
      generation_status: "generating",
      website_url: "https://new.example",
      document: readyDocument,
    });

    const second = await service.start("site-force", "u1", { force: true });
    expect(second.accepted).toBe(true);

    spins = 0;
    while (generateFromWebsite.mock.calls.length < 2) {
      spins += 1;
      if (spins > 50) {
        throw new Error("forced start did not call generateFromWebsite again");
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(generateFromWebsite).toHaveBeenCalledTimes(2);
    expect(generateFromWebsite).toHaveBeenLastCalledWith("site-force", "u1", "https://new.example", {
      skipRoadmapBootstrap: true,
    });

    resolveFirst(readyStrategy);
    await getStrategistBootstrapInflight("site-force");
    expect(markFailed).not.toHaveBeenCalled();
  });

  it("starts a new run when the workspace URL no longer matches the inflight URL", async () => {
    let resolveFirst: (value: typeof readyStrategy) => void = () => undefined;
    generateFromWebsite.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveFirst = resolve;
        })
    );
    generateFromWebsite.mockResolvedValueOnce(readyStrategy);

    await service.start("site-url-change", "u1");
    let spins = 0;
    while (generateFromWebsite.mock.calls.length === 0) {
      spins += 1;
      if (spins > 50) throw new Error("first generateFromWebsite was never called");
      await new Promise<void>((resolve) => setImmediate(resolve));
    }

    findById.mockResolvedValue({ website_url: "https://changed.example" });
    getActive.mockResolvedValue({
      generation_status: "generating",
      website_url: "https://changed.example",
      document: readyDocument,
    });

    const restarted = await service.start("site-url-change", "u1");
    expect(restarted.accepted).toBe(true);

    spins = 0;
    while (generateFromWebsite.mock.calls.length < 2) {
      spins += 1;
      if (spins > 50) {
        throw new Error("URL change did not start a new generateFromWebsite run");
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    expect(generateFromWebsite).toHaveBeenLastCalledWith("site-url-change", "u1", "https://changed.example", {
      skipRoadmapBootstrap: true,
    });

    resolveFirst(readyStrategy);
    await getStrategistBootstrapInflight("site-url-change");
  });
});

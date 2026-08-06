import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { OrchestratorMessageRole } from "../../../shared/schemas/orchestrator-message.schema";
import { WEBSITE_ONBOARDING_QUESTION } from "../../../modules/orchestrator/utils/website-onboarding.helper";

describe("OrchestratorService.startOnboardingInterview", () => {
  let OrchestratorService: typeof import("../../../modules/orchestrator/services/orchestrator.service").OrchestratorService;

  beforeEach(async () => {
    jest.resetModules();
    ({ OrchestratorService } = await import("../../../modules/orchestrator/services/orchestrator.service"));
  });

  function buildService(overrides: {
    memory?: Record<string, unknown>;
    progressComplete?: boolean;
    history?: Array<{
      _id: string;
      role: OrchestratorMessageRole;
      content: string;
      created_at: Date;
    }>;
    existingOnboardingThread?: { _id: string } | null;
  }) {
    const memory = {
      strategic: {},
      preferences: {},
      ...(overrides.memory ?? {}),
    };
    const history = overrides.history ?? [];
    const thread = { _id: "thread-1", site_id: "site-1", user_id: "user-1" };

    const createdMessages: Array<{ content: string }> = [];

    const service = new OrchestratorService(
      {} as never,
      {
        findOnboardingThread: jest.fn(async () =>
          overrides.existingOnboardingThread === undefined ? thread : overrides.existingOnboardingThread
        ),
        create: jest.fn(async () => thread),
        markOnboardingComplete: jest.fn(async () => undefined),
      } as never,
      {
        listByThread: jest.fn(async () => history),
        create: jest.fn(async (input: { content: string }) => {
          createdMessages.push({ content: input.content });
          return {
            _id: `msg-${createdMessages.length}`,
            content: input.content,
            created_at: new Date("2026-01-01T00:00:00Z"),
            role: OrchestratorMessageRole.ASSISTANT,
          };
        }),
      } as never,
      {} as never,
      {
        ensureForSite: jest.fn(async () => memory),
      } as never,
      {} as never,
      {
        hasSiteAccess: jest.fn(async () => true),
      } as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {
        getSetupProgress: jest.fn(async () => ({
          items: [],
          percent: overrides.progressComplete ? 100 : 0,
          complete: Boolean(overrides.progressComplete),
        })),
      } as never,
      {} as never,
      {} as never
    );

    return { service, createdMessages, thread };
  }

  it("asks the website gate question when onboarding path is unset", async () => {
    const { service, createdMessages, thread } = buildService({});
    const result = await service.startOnboardingInterview("site-1", "user-1");

    expect(result.complete).toBe(false);
    expect(result.thread_id).toBe(thread._id);
    expect(createdMessages).toHaveLength(1);
    expect(createdMessages[0].content).toContain(WEBSITE_ONBOARDING_QUESTION);
    expect(result.assistant_message?.content).toContain(WEBSITE_ONBOARDING_QUESTION);
  });

  it("is idempotent when the website question is already the last assistant message", async () => {
    const content = `Let's set up your workspace.\n\n${WEBSITE_ONBOARDING_QUESTION}`;
    const { service, createdMessages } = buildService({
      history: [
        {
          _id: "m1",
          role: OrchestratorMessageRole.ASSISTANT,
          content,
          created_at: new Date(),
        },
      ],
    });

    const result = await service.startOnboardingInterview("site-1", "user-1");

    expect(result.complete).toBe(false);
    expect(createdMessages).toHaveLength(0);
    expect(result.assistant_message?.id).toBe("m1");
    expect(result.assistant_message?.content).toContain(WEBSITE_ONBOARDING_QUESTION);
  });

  it("returns complete without appending when setup progress is already done", async () => {
    const { service, createdMessages } = buildService({
      progressComplete: true,
      existingOnboardingThread: { _id: "thread-old" },
    });

    const result = await service.startOnboardingInterview("site-1", "user-1");

    expect(result.complete).toBe(true);
    expect(createdMessages).toHaveLength(0);
    expect(result.assistant_message).toBeUndefined();
  });

  it("asks the next missing field when chat path is active and some memory is captured", async () => {
    const { service, createdMessages } = buildService({
      memory: {
        onboarding_path: "secondary",
        strategic: {
          business_description: "SaaS analytics for CMOs",
        },
        preferences: {},
      },
    });

    const result = await service.startOnboardingInterview("site-1", "user-1");

    expect(result.complete).toBe(false);
    expect(createdMessages[0].content).toContain("Is your business primarily B2B");
  });
});

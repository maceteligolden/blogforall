import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    identify: vi.fn(),
    shutdown: vi.fn().mockResolvedValue(undefined),
  })),
}));

vi.mock("../../shared/config/env", () => ({
  env: {
    posthog: {
      enabled: true,
      apiKey: "phc_test",
      host: "https://us.i.posthog.com",
      environment: "test",
    },
  },
}));

vi.mock("../../shared/observability/request-context", () => ({
  getRequestContext: () => ({ requestId: "req-1", sessionId: "sess-1" }),
}));

import { captureServerEvent, ServerAnalyticsEvents } from "../../shared/analytics/posthog.server";
import { PostHog } from "posthog-node";

describe("posthog.server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("captureServerEvent does not throw when PostHog is enabled", () => {
    expect(() =>
      captureServerEvent(ServerAnalyticsEvents.USER_SIGNED_UP, {
        userId: "user-1",
        properties: { plan_type: "free" },
      })
    ).not.toThrow();
    expect(PostHog).toHaveBeenCalled();
  });

  it("captureServerEvent is safe when disabled", async () => {
    const envModule = await import("../../shared/config/env");
    vi.spyOn(envModule.env.posthog, "enabled", "get").mockReturnValue(false);

    expect(() =>
      captureServerEvent(ServerAnalyticsEvents.USER_SIGNED_UP, { userId: "user-1" })
    ).not.toThrow();
  });
});

import { describe, expect, it, jest, beforeEach } from "@jest/globals";
import * as SentryModule from "../../shared/observability/sentry";

jest.mock("../../shared/observability/sentry", () => {
  const actual = jest.requireActual("../../shared/observability/sentry") as typeof SentryModule;
  return {
    ...actual,
    isSentryEnabled: () => true,
    captureSentryException: jest.fn(() => {
      throw new Error("sentry down");
    }),
    addSentryBreadcrumb: jest.fn(),
    safeSentry: (fn: () => unknown) => {
      try {
        return fn();
      } catch {
        return undefined;
      }
    },
  };
});

import { AppLogger } from "../../shared/observability/logger";

describe("AppLogger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("critical does not throw when Sentry capture fails", () => {
    expect(() => {
      AppLogger.critical("test critical", new Error("boom"), { flow: "token-reservation" });
    }).not.toThrow();
  });
});

import { beforeEach, describe, expect, it } from "@jest/globals";
import { TooManyRequestsError } from "../../../shared/errors";
import {
  __resetSlidingWindowRateLimitForTests,
  assertSlidingWindowRateLimit,
} from "../../../shared/utils/sliding-window-rate-limit";

describe("assertSlidingWindowRateLimit", () => {
  beforeEach(() => {
    __resetSlidingWindowRateLimitForTests();
  });

  it("allows requests under the max", () => {
    expect(() => assertSlidingWindowRateLimit("k", { windowMs: 60_000, max: 2, message: "slow down" })).not.toThrow();
    expect(() => assertSlidingWindowRateLimit("k", { windowMs: 60_000, max: 2, message: "slow down" })).not.toThrow();
  });

  it("throws TooManyRequestsError after the max", () => {
    assertSlidingWindowRateLimit("k", { windowMs: 60_000, max: 1, message: "slow down" });
    expect(() => assertSlidingWindowRateLimit("k", { windowMs: 60_000, max: 1, message: "slow down" })).toThrow(
      TooManyRequestsError
    );
  });
});

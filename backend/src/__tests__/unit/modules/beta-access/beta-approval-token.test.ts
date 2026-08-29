import { describe, expect, it } from "@jest/globals";
import {
  signBetaApprovalToken,
  verifyBetaApprovalToken,
} from "../../../../modules/beta-access/utils/beta-approval-token";

const SECRET = "test-beta-secret";

describe("beta approval token", () => {
  it("round-trips a user id", () => {
    const token = signBetaApprovalToken("user-1", SECRET, { now: 1_000, ttlMs: 60_000 });
    expect(verifyBetaApprovalToken(token, SECRET, { now: 1_500 })).toEqual({ userId: "user-1", exp: 61_000 });
  });

  it("rejects a tampered signature", () => {
    const token = signBetaApprovalToken("user-1", SECRET);
    const [body] = token.split(".");
    expect(() => verifyBetaApprovalToken(`${body}.aaaa`, SECRET)).toThrow("Invalid beta approval token");
  });

  it("rejects an expired token", () => {
    const token = signBetaApprovalToken("user-1", SECRET, { now: 1_000, ttlMs: 10 });
    expect(() => verifyBetaApprovalToken(token, SECRET, { now: 2_000 })).toThrow("Beta approval token has expired");
  });
});

import { describe, expect, it } from "@jest/globals";
import { AccountType, needsBetaApproval } from "../../../shared/constants";

describe("needsBetaApproval", () => {
  it("gates only unapproved beta accounts", () => {
    expect(needsBetaApproval({ account_type: AccountType.BETA, is_approved: false })).toBe(true);
    expect(needsBetaApproval({ account_type: AccountType.BETA, is_approved: true })).toBe(false);
    expect(needsBetaApproval({ account_type: AccountType.STANDARD, is_approved: false })).toBe(false);
    expect(needsBetaApproval(null)).toBe(false);
  });
});

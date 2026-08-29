import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AccountType } from "../../../../shared/constants";
import { signBetaApprovalToken } from "../../../../modules/beta-access/utils/beta-approval-token";

jest.mock("../../../../shared/config/env", () => ({
  env: {
    betaAccess: { notifyEmail: "macteligolden@gmail.com", tokenSecret: "test-secret", tokenTtlDays: 30 },
    frontend: { baseUrl: "http://localhost:3000" },
    notification: { redisUrl: "" },
  },
}));

import { BetaAccessService } from "../../../../modules/beta-access/services/beta-access.service";

const SECRET = "test-secret";

describe("BetaAccessService", () => {
  const user = {
    _id: "u1",
    first_name: "Ada",
    last_name: "Lovelace",
    email: "ada@example.com",
    account_type: AccountType.BETA,
    is_approved: false,
    beta_rejected_at: null,
  };

  let findById: jest.Mock;
  let update: jest.Mock;
  let createAndSend: jest.Mock;
  let service: BetaAccessService;

  beforeEach(() => {
    findById = jest.fn();
    update = jest.fn();
    createAndSend = jest.fn(async () => undefined);
    service = new BetaAccessService({ findById, update } as never, { createAndSend } as never);
  });

  it("approves a pending beta user and sends the granted email", async () => {
    findById.mockResolvedValue(user as never);
    update.mockResolvedValue({ ...user, is_approved: true, beta_rejected_at: null } as never);
    const token = signBetaApprovalToken("u1", SECRET);

    const result = await service.approve(token);

    expect(result.is_approved).toBe(true);
    expect(result.already_decided).toBe(false);
    expect(update).toHaveBeenCalledWith("u1", expect.objectContaining({ is_approved: true, beta_rejected_at: null }));
    await new Promise((r) => setImmediate(r));
    expect(createAndSend).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "beta_access_granted",
        recipientEmail: "ada@example.com",
      })
    );
  });

  it("is idempotent when the account is already approved", async () => {
    findById.mockResolvedValue({ ...user, is_approved: true } as never);
    const token = signBetaApprovalToken("u1", SECRET);

    const result = await service.approve(token);

    expect(result.already_decided).toBe(true);
    expect(update).not.toHaveBeenCalled();
    await new Promise((r) => setImmediate(r));
    expect(createAndSend).not.toHaveBeenCalled();
  });

  it("records reject without granting access", async () => {
    findById.mockResolvedValue(user as never);
    update.mockResolvedValue({ ...user, is_approved: false, beta_rejected_at: new Date() } as never);
    const token = signBetaApprovalToken("u1", SECRET);

    const result = await service.reject(token);

    expect(result.is_approved).toBe(false);
    expect(result.already_decided).toBe(false);
    expect(update).toHaveBeenCalledWith("u1", expect.objectContaining({ is_approved: false }));
    expect(createAndSend).not.toHaveBeenCalled();
  });
});

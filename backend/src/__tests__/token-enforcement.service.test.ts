import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import type { ClientSession } from "mongoose";
import { TokenEnforcementService } from "../modules/token-ledger/services/token-enforcement.service";
import { TokenLedgerRepository } from "../modules/token-ledger/repositories/token-ledger.repository";
import { TokenAllocationService } from "../modules/token-ledger/services/token-allocation.service";
import { TokenEstimationService } from "../modules/token-ledger/services/token-estimation.service";
import {
  TokenLedgerEntryStatus,
  TOKEN_WINDOW_MS,
} from "../shared/constants/token-ledger.constant";
import type { TokenLedger } from "../shared/schemas/token-ledger.schema";
import type { TokenLedgerEntry } from "../shared/schemas/token-ledger-entry.schema";

const USER_ID = "user-ledger-test";
const ALLOCATION = 100_000;

function makeLedger(overrides: Partial<TokenLedger> = {}): TokenLedger {
  const now = new Date();
  return {
    user_id: USER_ID,
    daily_allocation: ALLOCATION,
    window_start: now,
    used_tokens: 0,
    reserved_tokens: 0,
    active_request_id: null,
    active_request_expires_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
    ...overrides,
  } as TokenLedger;
}

describe("TokenEnforcementService", () => {
  let ledger: TokenLedger;
  let entries: Map<string, TokenLedgerEntry>;
  let mockRepo: jest.Mocked<TokenLedgerRepository>;
  let mockAllocation: jest.Mocked<TokenAllocationService>;
  let mockEstimation: jest.Mocked<TokenEstimationService>;
  let service: TokenEnforcementService;

  beforeEach(() => {
    ledger = makeLedger();
    entries = new Map();

    mockRepo = {
      findByUserId: jest.fn(async () => ledger),
      createLedger: jest.fn(async (input: {
        user_id: string;
        daily_allocation: number;
        window_start: Date;
      }) => {
        ledger = makeLedger({
          user_id: input.user_id,
          daily_allocation: input.daily_allocation,
          window_start: input.window_start,
        });
        return ledger;
      }),
      updateLedger: jest.fn(async (_userId: string, update: Partial<TokenLedger>) => {
        ledger = { ...ledger, ...update, updated_at: new Date() } as TokenLedger;
        return ledger;
      }),
      incrementLedger: jest.fn(
        async (_userId: string, inc: { used_tokens?: number; reserved_tokens?: number }) => {
          ledger = {
            ...ledger,
            used_tokens: (ledger.used_tokens ?? 0) + (inc.used_tokens ?? 0),
            reserved_tokens: (ledger.reserved_tokens ?? 0) + (inc.reserved_tokens ?? 0),
            updated_at: new Date(),
          } as TokenLedger;
          return ledger;
        }
      ),
      findEntryByRequestId: jest.fn(async (requestId: string) => entries.get(requestId) ?? null),
      createEntry: jest.fn(async (input: TokenLedgerEntry) => {
        const entry = {
          ...input,
          _id: `entry-${entries.size}`,
          created_at: new Date(),
          updated_at: new Date(),
        } as TokenLedgerEntry;
        entries.set(input.request_id, entry);
        return entry;
      }),
      updateEntry: jest.fn(async (requestId: string, update: Partial<TokenLedgerEntry>) => {
        const existing = entries.get(requestId);
        if (!existing) return null;
        const updated = { ...existing, ...update, updated_at: new Date() } as TokenLedgerEntry;
        entries.set(requestId, updated);
        return updated;
      }),
      withTransaction: jest.fn(async (fn: (session: ClientSession) => Promise<unknown>) =>
        fn({} as ClientSession)
      ),
      isDuplicateKeyError: jest.fn(() => false),
    } as unknown as jest.Mocked<TokenLedgerRepository>;

    mockAllocation = {
      getDailyAllocation: jest.fn(async () => ALLOCATION),
      isUnlimited: jest.fn((n: number) => n === -1),
    } as unknown as jest.Mocked<TokenAllocationService>;

    mockEstimation = {
      estimate: jest.fn(() => 5_000),
    } as unknown as jest.Mocked<TokenEstimationService>;

    service = new TokenEnforcementService(mockRepo, mockAllocation, mockEstimation);
  });

  it("resets balance when the 24h window has expired", async () => {
    const expiredStart = new Date(Date.now() - TOKEN_WINDOW_MS - 60_000);
    ledger = makeLedger({
      window_start: expiredStart,
      used_tokens: 90_000,
      reserved_tokens: 5_000,
    });

    const balance = await service.getBalance(USER_ID);
    expect(balance.used).toBe(0);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(ALLOCATION);
  });

  it("rejects reservation when estimate exceeds available tokens", async () => {
    ledger = makeLedger({ used_tokens: 98_000, reserved_tokens: 0 });
    mockEstimation.estimate.mockReturnValue(5_000);

    await expect(
      service.runWithReservation({
        userId: USER_ID,
        feature: "blog_generate",
        requestId: "req-reject",
        estimate: { feature: "blog_generate", promptText: "hello" },
        fn: async () => "ok",
      })
    ).rejects.toMatchObject({
      statusCode: 429,
      code: "TOKEN_LIMIT_EXCEEDED",
    });
  });

  it("rejects a second concurrent AI request for the same account", async () => {
    ledger = makeLedger({
      active_request_id: "in-flight",
      active_request_expires_at: new Date(Date.now() + 60_000),
    });

    await expect(
      service.runWithReservation({
        userId: USER_ID,
        feature: "orchestrator_chat",
        requestId: "req-concurrent",
        estimate: { feature: "orchestrator_chat", promptText: "hi" },
        fn: async () => "ok",
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "AI_REQUEST_IN_PROGRESS",
    });
  });

  it("refunds unused reserved tokens when actual usage is lower than estimate", async () => {
    mockEstimation.estimate.mockReturnValue(10_000);

    const result = await service.runWithReservation({
      userId: USER_ID,
      feature: "blog_review",
      requestId: "req-refund",
      estimate: { feature: "blog_review", promptText: "review" },
      fn: async () => "done",
    });

    expect(result).toBe("done");
    expect(ledger.used_tokens).toBeLessThanOrEqual(10_000);
    expect(ledger.reserved_tokens).toBe(0);
    expect(ledger.active_request_id).toBeNull();

    const entry = entries.get("req-refund");
    expect(entry?.status).toBe(TokenLedgerEntryStatus.COMMITTED);
  });

  it("treats duplicate committed request_id as already processed", async () => {
    entries.set("req-dup", {
      request_id: "req-dup",
      user_id: USER_ID,
      feature: "blog_generate",
      status: TokenLedgerEntryStatus.COMMITTED,
      estimated_tokens: 1000,
      reserved_tokens: 1000,
      actual_tokens: 1000,
      created_at: new Date(),
      updated_at: new Date(),
    } as TokenLedgerEntry);

    await expect(
      service.runWithReservation({
        userId: USER_ID,
        feature: "blog_generate",
        requestId: "req-dup",
        estimate: { feature: "blog_generate" },
        fn: async () => "should-not-run",
      })
    ).rejects.toMatchObject({ statusCode: 409 });
  });
});

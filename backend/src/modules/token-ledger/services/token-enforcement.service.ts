import { injectable } from "tsyringe";
import { randomUUID } from "crypto";
import { env } from "../../../shared/config/env";
import { AppLogger } from "../../../shared/observability/logger";
import { ObservabilityFlow } from "../../../shared/observability/flows";
import { logTokenEvent } from "../../../shared/observability/token-events";
import { getRequestIdFromContext } from "../../../shared/observability/request-context";
import {
  TokenLedgerEntryStatus,
  TOKEN_WINDOW_MS,
} from "../../../shared/constants/token-ledger.constant";
import {
  AiConcurrencyError,
  ConflictError,
  TokenLimitExceededError,
} from "../../../shared/errors";
import type { TokenLedger } from "../../../shared/schemas/token-ledger.schema";
import { TokenLedgerRepository } from "../repositories/token-ledger.repository";
import { TokenAllocationService } from "./token-allocation.service";
import { TokenEstimationService } from "./token-estimation.service";
import type {
  TokenBalanceSnapshot,
  TokenEstimateInput,
} from "../interfaces/token-ledger.interface";
import {
  getAccumulatedTokenUsage,
  getTokenRequestContext,
  isNestedTokenContext,
  runWithTokenRequestContext,
} from "../../../shared/ai/token-request-context";

@injectable()
export class TokenEnforcementService {
  constructor(
    private readonly ledgerRepository: TokenLedgerRepository,
    private readonly allocationService: TokenAllocationService,
    private readonly estimationService: TokenEstimationService
  ) {}

  async getBalance(userId: string): Promise<TokenBalanceSnapshot> {
    const allocation = await this.allocationService.getDailyAllocation(userId);
    if (this.allocationService.isUnlimited(allocation)) {
      return {
        used: 0,
        allocation,
        reserved: 0,
        available: allocation,
        window_start: new Date().toISOString(),
        reset_at: new Date().toISOString(),
        unlimited: true,
      };
    }

    const ledger = await this.ensureLedger(userId, allocation);
    const now = Date.now();
    const windowStart = ledger.window_start.getTime();
    const windowMs = env.tokenLedger.windowMs || TOKEN_WINDOW_MS;
    const resetAt = new Date(windowStart + windowMs);

    let used = ledger.used_tokens;
    let reserved = ledger.reserved_tokens;
    if (now >= resetAt.getTime()) {
      used = 0;
      reserved = 0;
    }

    const available = Math.max(0, allocation - used - reserved);
    return {
      used,
      allocation,
      reserved,
      available,
      window_start: ledger.window_start.toISOString(),
      reset_at: resetAt.toISOString(),
      unlimited: false,
    };
  }

  /**
   * Single choke point: estimate → reserve → run fn (with ALS) → reconcile.
   * Nested contexts (orchestrator tools) skip reserve and only accumulate usage.
   */
  async runWithReservation<T>(args: {
    userId: string;
    feature: string;
    siteId?: string;
    requestId?: string;
    estimate: TokenEstimateInput;
    fn: () => Promise<T>;
  }): Promise<T> {
    if (isNestedTokenContext()) {
      return args.fn();
    }

    const allocation = await this.allocationService.getDailyAllocation(args.userId);
    if (this.allocationService.isUnlimited(allocation)) {
      const requestId = args.requestId ?? randomUUID();
      return runWithTokenRequestContext(
        {
          requestId,
          userId: args.userId,
          feature: args.feature,
          siteId: args.siteId,
          nested: false,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        },
        args.fn
      );
    }

    const requestId = args.requestId ?? getRequestIdFromContext() ?? randomUUID();
    const estimatedTokens = this.estimationService.estimate(args.estimate);
    logTokenEvent("token_estimate_calculated", {
      userId: args.userId,
      requestId,
      feature: args.feature,
      siteId: args.siteId,
      estimatedTokens,
    });
    const startedAt = Date.now();

    const existing = await this.ledgerRepository.findEntryByRequestId(requestId);
    if (existing?.status === TokenLedgerEntryStatus.COMMITTED) {
      throw new ConflictError("This request was already processed");
    }

    await this.reserveTokens({
      userId: args.userId,
      requestId,
      feature: args.feature,
      siteId: args.siteId,
      estimatedTokens,
    });

    try {
      const result = await runWithTokenRequestContext(
        {
          requestId,
          userId: args.userId,
          feature: args.feature,
          siteId: args.siteId,
          nested: false,
          usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
        },
        args.fn
      );

      const usage = getAccumulatedTokenUsage();
      const actualTokens =
        usage.total_tokens > 0 ? usage.total_tokens : estimatedTokens;

      await this.finalizeReservation({
        userId: args.userId,
        requestId,
        reservedTokens: estimatedTokens,
        actualTokens,
        success: true,
        durationMs: Date.now() - startedAt,
      });

      return result;
    } catch (error) {
      const usage = getAccumulatedTokenUsage();
      const actualTokens = usage.total_tokens;
      await this.finalizeReservation({
        userId: args.userId,
        requestId,
        reservedTokens: estimatedTokens,
        actualTokens,
        success: false,
        durationMs: Date.now() - startedAt,
        errorMessage: error instanceof Error ? error.message : String(error),
      }).catch((finalizeErr) => {
        AppLogger.critical(
          "Token finalize after failure errored",
          finalizeErr as Error,
          {
            flow: ObservabilityFlow.TOKEN_RECONCILE,
            requestId,
            userId: args.userId,
          },
          "TokenEnforcementService"
        );
      });
      throw error;
    }
  }

  private async ensureLedger(userId: string, allocation: number): Promise<TokenLedger> {
    let ledger = await this.ledgerRepository.findByUserId(userId);
    if (!ledger) {
      ledger = await this.ledgerRepository.createLedger({
        user_id: userId,
        daily_allocation: allocation,
        window_start: new Date(),
      });
    }
    return ledger;
  }

  private async reserveTokens(args: {
    userId: string;
    requestId: string;
    feature: string;
    siteId?: string;
    estimatedTokens: number;
  }): Promise<void> {
    const allocation = await this.allocationService.getDailyAllocation(args.userId);
    const now = new Date();
    const lockExpires = new Date(now.getTime() + env.tokenLedger.activeRequestTtlMs);
    const windowMs = env.tokenLedger.windowMs || TOKEN_WINDOW_MS;

    await this.ledgerRepository.withTransaction(async (session) => {
      let ledger = await this.ledgerRepository.findByUserId(args.userId, session);
      if (!ledger) {
        ledger = await this.ledgerRepository.createLedger(
          {
            user_id: args.userId,
            daily_allocation: allocation,
            window_start: now,
          },
          session
        );
      }

      const windowExpired =
        !ledger.window_start ||
        now.getTime() >= ledger.window_start.getTime() + windowMs;

      if (windowExpired) {
        logTokenEvent("token_window_reset", {
          userId: args.userId,
          requestId: args.requestId,
          allocation,
        });
        ledger = (await this.ledgerRepository.updateLedger(
          args.userId,
          {
            window_start: now,
            used_tokens: 0,
            reserved_tokens: 0,
            daily_allocation: allocation,
            active_request_id: null,
            active_request_expires_at: null,
          },
          session
        ))!;
      }

      const staleLock =
        ledger.active_request_id &&
        ledger.active_request_expires_at &&
        ledger.active_request_expires_at < now;

      if (ledger.active_request_id && !staleLock) {
        throw new AiConcurrencyError();
      }

      if (staleLock && ledger.active_request_id) {
        const staleEntry = await this.ledgerRepository.findEntryByRequestId(
          ledger.active_request_id,
          session
        );
        if (staleEntry?.status === TokenLedgerEntryStatus.RESERVED) {
          await this.ledgerRepository.updateEntry(
            ledger.active_request_id,
            { status: TokenLedgerEntryStatus.RELEASED },
            session
          );
          await this.ledgerRepository.incrementLedger(
            args.userId,
            { reserved_tokens: -(staleEntry.reserved_tokens ?? 0) },
            session
          );
        }
        await this.ledgerRepository.updateLedger(
          args.userId,
          { active_request_id: null, active_request_expires_at: null },
          session
        );
        ledger = (await this.ledgerRepository.findByUserId(args.userId, session))!;
      }

      const used = ledger.used_tokens ?? 0;
      const reserved = ledger.reserved_tokens ?? 0;
      const available = allocation - used - reserved;

      if (args.estimatedTokens > available) {
        const resetAt = new Date(ledger.window_start.getTime() + windowMs);
        logTokenEvent("token_rejected", {
          userId: args.userId,
          requestId: args.requestId,
          feature: args.feature,
          estimatedTokens: args.estimatedTokens,
          availableTokens: available,
          usedTokens: used,
          reservedTokens: reserved,
        });
        throw new TokenLimitExceededError(
          "Token limit reached. Try again after your daily window resets.",
          resetAt
        );
      }

      try {
        await this.ledgerRepository.createEntry(
          {
            request_id: args.requestId,
            user_id: args.userId,
            feature: args.feature,
            site_id: args.siteId,
            status: TokenLedgerEntryStatus.RESERVED,
            estimated_tokens: args.estimatedTokens,
            reserved_tokens: args.estimatedTokens,
          },
          session
        );
      } catch (err) {
        if (this.ledgerRepository.isDuplicateKeyError(err)) {
          const dup = await this.ledgerRepository.findEntryByRequestId(args.requestId, session);
          if (dup?.status === TokenLedgerEntryStatus.COMMITTED) {
            return;
          }
          if (dup?.status === TokenLedgerEntryStatus.RESERVED) {
            return;
          }
        }
        throw err;
      }

      await this.ledgerRepository.incrementLedger(
        args.userId,
        { reserved_tokens: args.estimatedTokens },
        session
      );

      await this.ledgerRepository.updateLedger(
        args.userId,
        {
          active_request_id: args.requestId,
          active_request_expires_at: lockExpires,
        },
        session
      );
    });

    logTokenEvent("token_reserved", {
      userId: args.userId,
      requestId: args.requestId,
      feature: args.feature,
      estimatedTokens: args.estimatedTokens,
    });
  }

  private async finalizeReservation(args: {
    userId: string;
    requestId: string;
    reservedTokens: number;
    actualTokens: number;
    success: boolean;
    durationMs: number;
    errorMessage?: string;
  }): Promise<void> {
    const actual = Math.max(0, args.actualTokens);
    const delta = actual - args.reservedTokens;

    await this.ledgerRepository.withTransaction(async (session) => {
      const entry = await this.ledgerRepository.findEntryByRequestId(args.requestId, session);
      if (!entry) return;
      if (
        entry.status === TokenLedgerEntryStatus.COMMITTED ||
        entry.status === TokenLedgerEntryStatus.FAILED
      ) {
        return;
      }

      await this.ledgerRepository.incrementLedger(
        args.userId,
        {
          used_tokens: actual,
          reserved_tokens: -args.reservedTokens,
        },
        session
      );

      await this.ledgerRepository.updateLedger(
        args.userId,
        {
          active_request_id: null,
          active_request_expires_at: null,
        },
        session
      );

      await this.ledgerRepository.updateEntry(
        args.requestId,
        {
          status: args.success
            ? TokenLedgerEntryStatus.COMMITTED
            : TokenLedgerEntryStatus.FAILED,
          actual_tokens: actual,
          delta,
          duration_ms: args.durationMs,
          success: args.success,
          metadata: args.errorMessage ? { error: args.errorMessage.slice(0, 500) } : undefined,
        },
        session
      );
    });

    if (args.success) {
      logTokenEvent("token_reconciled", {
        userId: args.userId,
        requestId: args.requestId,
        reservedTokens: args.reservedTokens,
        actualTokens: actual,
        delta,
        durationMs: args.durationMs,
      });
      if (delta < 0) {
        logTokenEvent("token_refund_applied", {
          userId: args.userId,
          requestId: args.requestId,
          refundTokens: -delta,
        });
      }
    } else {
      AppLogger.critical(
        "Token reconciliation failed",
        args.errorMessage ? new Error(args.errorMessage) : undefined,
        {
          flow: ObservabilityFlow.TOKEN_RECONCILE,
          userId: args.userId,
          requestId: args.requestId,
          actualTokens: actual,
        },
        "TokenEnforcementService"
      );
    }
  }

  /** Mark nested tool execution so child LLM calls bill to parent ALS context. */
  async runNested<T>(fn: () => Promise<T>): Promise<T> {
    const parent = getTokenRequestContext();
    if (!parent) {
      return fn();
    }
    return runWithTokenRequestContext({ ...parent, nested: true }, fn);
  }
}

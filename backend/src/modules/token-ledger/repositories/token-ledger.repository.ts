import { injectable } from "tsyringe";
import mongoose, { ClientSession } from "mongoose";
import { TokenLedgerModel, type TokenLedger } from "../../../shared/schemas/token-ledger.schema";
import { TokenLedgerEntryModel, type TokenLedgerEntry } from "../../../shared/schemas/token-ledger-entry.schema";
import { TokenLedgerEntryStatus } from "../../../shared/constants/token-ledger.constant";
import { logger } from "../../../shared/utils/logger";

function isTransactionsUnsupportedError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /Transaction numbers are only allowed/i.test(message) || /not supported.*transaction/i.test(message);
}

@injectable()
export class TokenLedgerRepository {
  async findByUserId(userId: string, session?: ClientSession): Promise<TokenLedger | null> {
    return TokenLedgerModel.findOne({ user_id: userId }).session(session ?? null);
  }

  async createLedger(
    input: {
      user_id: string;
      daily_allocation: number;
      window_start: Date;
    },
    session?: ClientSession
  ): Promise<TokenLedger> {
    const doc = new TokenLedgerModel({
      user_id: input.user_id,
      daily_allocation: input.daily_allocation,
      window_start: input.window_start,
      used_tokens: 0,
      reserved_tokens: 0,
      active_request_id: null,
      active_request_expires_at: null,
      version: 0,
    });
    return doc.save({ session: session ?? undefined });
  }

  async updateLedger(
    userId: string,
    update: Partial<
      Pick<
        TokenLedger,
        | "daily_allocation"
        | "window_start"
        | "used_tokens"
        | "reserved_tokens"
        | "active_request_id"
        | "active_request_expires_at"
        | "version"
      >
    >,
    session?: ClientSession
  ): Promise<TokenLedger | null> {
    return TokenLedgerModel.findOneAndUpdate(
      { user_id: userId },
      { $set: { ...update, updated_at: new Date() } },
      { new: true, session: session ?? undefined }
    );
  }

  async incrementLedger(
    userId: string,
    inc: { used_tokens?: number; reserved_tokens?: number },
    session?: ClientSession
  ): Promise<TokenLedger | null> {
    const $inc: Record<string, number> = {};
    if (inc.used_tokens) $inc.used_tokens = inc.used_tokens;
    if (inc.reserved_tokens) $inc.reserved_tokens = inc.reserved_tokens;
    return TokenLedgerModel.findOneAndUpdate(
      { user_id: userId },
      { $inc, $set: { updated_at: new Date() } },
      { new: true, session: session ?? undefined }
    );
  }

  async findEntryByRequestId(requestId: string, session?: ClientSession): Promise<TokenLedgerEntry | null> {
    return TokenLedgerEntryModel.findOne({ request_id: requestId }).session(session ?? null);
  }

  async createEntry(
    input: Omit<TokenLedgerEntry, "_id" | "created_at" | "updated_at">,
    session?: ClientSession
  ): Promise<TokenLedgerEntry> {
    const doc = new TokenLedgerEntryModel(input);
    return doc.save({ session: session ?? undefined });
  }

  async updateEntry(
    requestId: string,
    update: Partial<
      Pick<
        TokenLedgerEntry,
        "status" | "actual_tokens" | "delta" | "duration_ms" | "success" | "metadata" | "reserved_tokens"
      >
    >,
    session?: ClientSession
  ): Promise<TokenLedgerEntry | null> {
    return TokenLedgerEntryModel.findOneAndUpdate(
      { request_id: requestId },
      { $set: { ...update, updated_at: new Date() } },
      { new: true, session: session ?? undefined }
    );
  }

  private transactionsSupported: boolean | null = null;
  private loggedStandaloneFallback = false;

  /**
   * Replica set / mongos: run `fn` in a Mongo transaction.
   * Standalone (typical local mongod): run `fn` with no session so the driver
   * cannot retry the callback in a tight loop.
   */
  async withTransaction<T>(fn: (session?: ClientSession) => Promise<T>): Promise<T> {
    if (!(await this.mongoSupportsTransactions())) {
      return fn(undefined);
    }

    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } catch (error) {
      if (isTransactionsUnsupportedError(error)) {
        this.transactionsSupported = false;
        this.warnStandaloneFallback();
        return fn(undefined);
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  private async mongoSupportsTransactions(): Promise<boolean> {
    if (this.transactionsSupported !== null) {
      return this.transactionsSupported;
    }
    try {
      const db = mongoose.connection.db;
      if (!db) {
        this.transactionsSupported = false;
        this.warnStandaloneFallback();
        return false;
      }
      const hello = (await db.admin().command({ hello: 1 })) as { setName?: string; msg?: string };
      this.transactionsSupported = Boolean(hello.setName || hello.msg === "isdbgrid");
    } catch {
      this.transactionsSupported = false;
    }
    if (!this.transactionsSupported) {
      this.warnStandaloneFallback();
    }
    return this.transactionsSupported;
  }

  private warnStandaloneFallback(): void {
    if (this.loggedStandaloneFallback) return;
    this.loggedStandaloneFallback = true;
    logger.warn(
      "Mongo transactions unavailable (standalone); token ledger runs without sessions",
      {},
      "TokenLedger"
    );
  }

  isDuplicateKeyError(error: unknown): boolean {
    return error instanceof Error && "code" in error && (error as { code?: number }).code === 11000;
  }

  entryStatusCommitted = TokenLedgerEntryStatus.COMMITTED;
  entryStatusReserved = TokenLedgerEntryStatus.RESERVED;
  entryStatusFailed = TokenLedgerEntryStatus.FAILED;
  entryStatusReleased = TokenLedgerEntryStatus.RELEASED;

  async getTotalUsageTokens(): Promise<number> {
    const rows = await TokenLedgerEntryModel.aggregate<{ total: number }>([
      {
        $group: {
          _id: null,
          total: {
            $sum: {
              $ifNull: ["$actual_tokens", "$estimated_tokens"],
            },
          },
        },
      },
    ]);
    return rows[0]?.total ?? 0;
  }

  async getDailyUsage(input: { from?: Date; to?: Date }): Promise<Array<{ date: string; tokens: number }>> {
    const match: Record<string, unknown> = {};
    if (input.from || input.to) {
      match.created_at = {};
      if (input.from) (match.created_at as Record<string, unknown>).$gte = input.from;
      if (input.to) (match.created_at as Record<string, unknown>).$lte = input.to;
    }

    const rows = await TokenLedgerEntryModel.aggregate<{ _id: string; tokens: number }>([
      { $match: match },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          tokens: { $sum: { $ifNull: ["$actual_tokens", "$estimated_tokens"] } },
        },
      },
      { $sort: { _id: -1 } },
    ]);

    return rows.map((r) => ({ date: r._id, tokens: r.tokens }));
  }

  async getDailyUsageByUser(input: {
    from?: Date;
    to?: Date;
  }): Promise<Array<{ date: string; user_id: string; tokens: number }>> {
    const match: Record<string, unknown> = {};
    if (input.from || input.to) {
      match.created_at = {};
      if (input.from) (match.created_at as Record<string, unknown>).$gte = input.from;
      if (input.to) (match.created_at as Record<string, unknown>).$lte = input.to;
    }

    const rows = await TokenLedgerEntryModel.aggregate<{ _id: { date: string; user_id: string }; tokens: number }>([
      { $match: match },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
            user_id: "$user_id",
          },
          tokens: { $sum: { $ifNull: ["$actual_tokens", "$estimated_tokens"] } },
        },
      },
      { $sort: { "_id.date": -1 } },
    ]);

    return rows.map((r) => ({
      date: r._id.date,
      user_id: r._id.user_id,
      tokens: r.tokens,
    }));
  }

  async getUsageTotalsByUsers(userIds: string[], input: { from?: Date; to?: Date }): Promise<Record<string, number>> {
    if (!userIds.length) return {};
    const match: Record<string, unknown> = { user_id: { $in: userIds } };
    if (input.from || input.to) {
      match.created_at = {};
      if (input.from) (match.created_at as Record<string, unknown>).$gte = input.from;
      if (input.to) (match.created_at as Record<string, unknown>).$lte = input.to;
    }
    const rows = await TokenLedgerEntryModel.aggregate<{ _id: string; tokens: number }>([
      { $match: match },
      {
        $group: {
          _id: "$user_id",
          tokens: { $sum: { $ifNull: ["$actual_tokens", "$estimated_tokens"] } },
        },
      },
    ]);
    return rows.reduce<Record<string, number>>((acc, row) => {
      acc[row._id] = row.tokens;
      return acc;
    }, {});
  }
}

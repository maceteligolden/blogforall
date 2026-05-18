import { injectable } from "tsyringe";
import mongoose, { ClientSession } from "mongoose";
import { TokenLedgerModel, type TokenLedger } from "../../../shared/schemas/token-ledger.schema";
import {
  TokenLedgerEntryModel,
  type TokenLedgerEntry,
} from "../../../shared/schemas/token-ledger-entry.schema";
import { TokenLedgerEntryStatus } from "../../../shared/constants/token-ledger.constant";

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

  async findEntryByRequestId(
    requestId: string,
    session?: ClientSession
  ): Promise<TokenLedgerEntry | null> {
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
        | "status"
        | "actual_tokens"
        | "delta"
        | "duration_ms"
        | "success"
        | "metadata"
        | "reserved_tokens"
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

  /** Run a callback inside a MongoDB transaction (requires replica set in production). */
  async withTransaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await mongoose.startSession();
    try {
      let result!: T;
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  isDuplicateKeyError(error: unknown): boolean {
    return (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    );
  }

  entryStatusCommitted = TokenLedgerEntryStatus.COMMITTED;
  entryStatusReserved = TokenLedgerEntryStatus.RESERVED;
  entryStatusFailed = TokenLedgerEntryStatus.FAILED;
  entryStatusReleased = TokenLedgerEntryStatus.RELEASED;
}

import type { TokenLedgerFeature } from "../../../shared/constants/token-ledger.constant";

export interface TokenUsageTotals {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface TokenBalanceSnapshot {
  used: number;
  allocation: number;
  reserved: number;
  available: number;
  window_start: string;
  reset_at: string;
  unlimited: boolean;
}

export interface TokenReservationContext {
  requestId: string;
  userId: string;
  feature: TokenLedgerFeature | string;
  siteId?: string;
  estimatedTokens: number;
  reservedTokens: number;
  startedAt: number;
}

export interface TokenEstimateInput {
  feature: TokenLedgerFeature | string;
  promptText?: string;
  contextText?: string;
  expectedOutputTokens?: number;
  wordCount?: number;
}

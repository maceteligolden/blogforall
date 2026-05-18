import { AsyncLocalStorage } from "async_hooks";
import type { TokenUsageTotals } from "../../modules/token-ledger/interfaces/token-ledger.interface";

export interface TokenRequestStore {
  requestId: string;
  userId: string;
  feature: string;
  siteId?: string;
  /** When true, nested AI calls accumulate into parent request (no second reservation). */
  nested: boolean;
  usage: TokenUsageTotals;
}

const storage = new AsyncLocalStorage<TokenRequestStore>();

export function runWithTokenRequestContext<T>(store: TokenRequestStore, fn: () => Promise<T>): Promise<T> {
  return storage.run(store, fn);
}

export function getTokenRequestContext(): TokenRequestStore | undefined {
  return storage.getStore();
}

export function isNestedTokenContext(): boolean {
  return storage.getStore()?.nested === true;
}

export function addTokenUsage(usage: Partial<TokenUsageTotals>): void {
  const store = storage.getStore();
  if (!store) return;
  store.usage.prompt_tokens += usage.prompt_tokens ?? 0;
  store.usage.completion_tokens += usage.completion_tokens ?? 0;
  store.usage.total_tokens += usage.total_tokens ?? 0;
}

export function getAccumulatedTokenUsage(): TokenUsageTotals {
  const store = storage.getStore();
  return store?.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
}

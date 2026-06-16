import type { LLMResult } from "@langchain/core/outputs";
import type { BaseMessage } from "@langchain/core/messages";
import type { TokenUsageTotals } from "../interfaces/token-ledger.interface";

const EMPTY_USAGE: TokenUsageTotals = {
  prompt_tokens: 0,
  completion_tokens: 0,
  total_tokens: 0,
};

function parseUsageRecord(raw: unknown): TokenUsageTotals {
  if (!raw || typeof raw !== "object") return { ...EMPTY_USAGE };
  const u = raw as Record<string, number | undefined>;
  const prompt = u.prompt_tokens ?? u.input_tokens ?? 0;
  const completion = u.completion_tokens ?? u.output_tokens ?? 0;
  const total = u.total_tokens ?? prompt + completion;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: total,
  };
}

export function extractUsageFromLlmResult(output: LLMResult): TokenUsageTotals {
  const llmOutput = output.llmOutput as Record<string, unknown> | undefined;
  if (llmOutput?.tokenUsage) {
    return parseUsageRecord(llmOutput.tokenUsage);
  }
  if (llmOutput?.usage) {
    return parseUsageRecord(llmOutput.usage);
  }
  const generations = output.generations?.[0]?.[0];
  const message = generations as { message?: BaseMessage } | undefined;
  const meta = message?.message?.response_metadata as Record<string, unknown> | undefined;
  if (meta?.token_usage) {
    return parseUsageRecord(meta.token_usage);
  }
  if (meta?.usage) {
    return parseUsageRecord(meta.usage);
  }
  return { ...EMPTY_USAGE };
}

export function sumUsage(...usages: TokenUsageTotals[]): TokenUsageTotals {
  return usages.reduce(
    (acc, u) => ({
      prompt_tokens: acc.prompt_tokens + u.prompt_tokens,
      completion_tokens: acc.completion_tokens + u.completion_tokens,
      total_tokens: acc.total_tokens + u.total_tokens,
    }),
    { ...EMPTY_USAGE }
  );
}

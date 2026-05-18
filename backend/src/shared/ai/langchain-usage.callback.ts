import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { LLMResult } from "@langchain/core/outputs";
import { addTokenUsage } from "./token-request-context";
import { extractUsageFromLlmResult } from "../../modules/token-ledger/services/token-usage-extractor";

/**
 * Accumulates OpenAI token usage into the active AsyncLocalStorage request context.
 */
export class LangchainUsageCallbackHandler extends BaseCallbackHandler {
  name = "LangchainUsageCallbackHandler";

  async handleLLMEnd(output: LLMResult): Promise<void> {
    const usage = extractUsageFromLlmResult(output);
    if (usage.total_tokens > 0) {
      addTokenUsage(usage);
    }
  }
}

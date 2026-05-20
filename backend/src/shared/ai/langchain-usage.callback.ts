import { BaseCallbackHandler } from "@langchain/core/callbacks/base";
import type { LLMResult } from "@langchain/core/outputs";
import type { Serialized } from "@langchain/core/load/serializable";
import * as Sentry from "@sentry/node";
import { addTokenUsage } from "./token-request-context";
import { extractUsageFromLlmResult } from "../../modules/token-ledger/services/token-usage-extractor";
import { AppLogger } from "../observability/logger";
import { ObservabilityFlow } from "../observability/flows";
import { getRequestIdFromContext } from "../observability/request-context";
import { addSentryBreadcrumb, safeSentry } from "../observability/sentry";

/**
 * Accumulates OpenAI token usage into the active AsyncLocalStorage request context.
 */
export class LangchainUsageCallbackHandler extends BaseCallbackHandler {
  name = "LangchainUsageCallbackHandler";

  private span: ReturnType<typeof Sentry.startInactiveSpan> | undefined;
  private modelName = "unknown";

  async handleLLMStart(llm: Serialized): Promise<void> {
    const model =
      (llm as { kwargs?: { model?: string }; model?: string }).kwargs?.model ??
      (llm as { model?: string }).model ??
      "unknown";
    this.modelName = model;

    safeSentry(() => {
      this.span = Sentry.startInactiveSpan({
        name: "openai.chat",
        op: "ai.chat",
        attributes: { model: this.modelName },
      });
    });
  }

  async handleLLMEnd(output: LLMResult): Promise<void> {
    const usage = extractUsageFromLlmResult(output);
    if (usage.total_tokens > 0) {
      addTokenUsage(usage);
      addSentryBreadcrumb("openai.tokens", "info", {
        model: this.modelName,
        ...usage,
        requestId: getRequestIdFromContext(),
      });
    }

    safeSentry(() => {
      this.span?.setAttributes({
        "gen_ai.usage.input_tokens": usage.prompt_tokens,
        "gen_ai.usage.output_tokens": usage.completion_tokens,
        "gen_ai.usage.total_tokens": usage.total_tokens,
      });
      this.span?.end();
      this.span = undefined;
    });
  }

  async handleLLMError(error: Error): Promise<void> {
    safeSentry(() => {
      this.span?.setStatus({ code: 2, message: error.message });
      this.span?.end();
      this.span = undefined;
    });

    AppLogger.critical(
      "OpenAI request failed",
      error,
      {
        flow: ObservabilityFlow.OPENAI_REQUEST,
        model: this.modelName,
        requestId: getRequestIdFromContext(),
      },
      "LangchainUsageCallback"
    );
  }
}

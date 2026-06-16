import { ChatOpenAI } from "@langchain/openai";
import { LangchainUsageCallbackHandler } from "./langchain-usage.callback";
import { getTokenRequestContext } from "./token-request-context";
import { getRequestContext } from "../observability/request-context";

export interface CreateChatOpenAIOptions {
  apiKey: string;
  model: string;
  temperature?: number;
  timeout?: number;
}

/**
 * Construct ChatOpenAI with usage callback when inside a token reservation context.
 */
export function createChatOpenAI(options: CreateChatOpenAIOptions): ChatOpenAI {
  const callbacks =
    getTokenRequestContext() || getRequestContext()
      ? [new LangchainUsageCallbackHandler()]
      : [];
  return new ChatOpenAI({
    apiKey: options.apiKey,
    model: options.model,
    temperature: options.temperature ?? 0.4,
    timeout: options.timeout,
    callbacks,
  });
}

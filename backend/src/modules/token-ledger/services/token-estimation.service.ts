import { injectable } from "tsyringe";
import { getEncoding } from "js-tiktoken";
import {
  TOKEN_ESTIMATE_BUFFER_RATIO,
  TokenLedgerFeature,
} from "../../../shared/constants/token-ledger.constant";
import type { TokenEstimateInput } from "../interfaces/token-ledger.interface";

const encoding = getEncoding("cl100k_base");

@injectable()
export class TokenEstimationService {
  countText(text: string): number {
    if (!text?.trim()) return 0;
    try {
      return encoding.encode(text).length;
    } catch {
      return Math.ceil(text.length / 4);
    }
  }

  estimate(input: TokenEstimateInput): number {
    const promptTokens = this.countText(input.promptText ?? "");
    const contextTokens = this.countText(input.contextText ?? "");
    let inputTotal = promptTokens + contextTokens;

    let outputEstimate = input.expectedOutputTokens ?? 0;

    if (!outputEstimate) {
      switch (input.feature) {
        case TokenLedgerFeature.BLOG_GENERATE:
        case TokenLedgerFeature.BLOG_ANALYZE:
          outputEstimate = Math.max(
            Math.ceil((input.wordCount ?? 1500) * 1.3),
            2500
          );
          break;
        case TokenLedgerFeature.BLOG_REVIEW:
          outputEstimate = 800;
          break;
        case TokenLedgerFeature.MEMORY_DIGEST:
          outputEstimate = 1200;
          break;
        case TokenLedgerFeature.ORCHESTRATOR_CHAT:
        case TokenLedgerFeature.ORCHESTRATOR_ONBOARDING:
          outputEstimate = Math.max(Math.ceil(inputTotal * 1.2), 4000);
          break;
        case TokenLedgerFeature.SCHEDULED_BLOG_PREPARE:
          outputEstimate = Math.max(Math.ceil((input.wordCount ?? 1500) * 1.3), 2500);
          break;
        default:
          outputEstimate = Math.max(Math.ceil(inputTotal * 1.2), 2000);
      }
    }

    if (
      input.feature === TokenLedgerFeature.ORCHESTRATOR_CHAT ||
      input.feature === TokenLedgerFeature.ORCHESTRATOR_ONBOARDING
    ) {
      inputTotal += 4000;
    }

    const subtotal = inputTotal + outputEstimate;
    return Math.ceil(subtotal * (1 + TOKEN_ESTIMATE_BUFFER_RATIO));
  }
}

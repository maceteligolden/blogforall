import { AppLogger, type LogMetadata } from "./logger";
import { ObservabilityFlow } from "./flows";
import { addSentryBreadcrumb } from "./sentry";

export type TokenLedgerEventName =
  | "token_estimate_calculated"
  | "token_reserved"
  | "token_rejected"
  | "token_reconciled"
  | "token_refund_applied"
  | "token_window_reset";

export function logTokenEvent(
  event: TokenLedgerEventName,
  metadata: LogMetadata,
  context = "TokenLedger"
): void {
  const enriched = { ...metadata, event };

  switch (event) {
    case "token_rejected":
      AppLogger.critical(`Token ledger: ${event}`, undefined, {
        ...enriched,
        flow: ObservabilityFlow.TOKEN_RESERVATION,
      }, context);
      break;
    default:
      AppLogger.info(`Token ledger: ${event}`, enriched, context);
      addSentryBreadcrumb(`token.${event}`, "info", enriched as Record<string, unknown>);
      break;
  }
}

import { isAxiosError } from "axios";
import { parseTokenLimitError, TOKEN_LIMIT_EXCEEDED_CODE } from "../utils/token-limit-error";

export function extractApiErrorCode(error: unknown): string | undefined {
  if (parseTokenLimitError(error)) {
    return TOKEN_LIMIT_EXCEEDED_CODE;
  }
  if (isAxiosError(error)) {
    const data = error.response?.data as { code?: string };
    if (data?.code) return data.code;
    if (error.response?.status === 409) return "AI_CONCURRENCY";
    if (error.response?.status === 429) return "RATE_LIMITED";
  }
  return undefined;
}

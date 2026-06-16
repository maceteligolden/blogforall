import { isAxiosError } from "axios";

export const TOKEN_LIMIT_EXCEEDED_CODE = "TOKEN_LIMIT_EXCEEDED";

export interface TokenLimitErrorInfo {
  code: string;
  message: string;
  resetAt: string | null;
}

export function parseTokenLimitError(error: unknown): TokenLimitErrorInfo | null {
  if (!isAxiosError(error) || error.response?.status !== 429) {
    return null;
  }
  const data = error.response.data as {
    code?: string;
    message?: string;
    reset_at?: string;
  };
  if (data?.code !== TOKEN_LIMIT_EXCEEDED_CODE) {
    return null;
  }
  return {
    code: data.code,
    message: data.message ?? "Daily AI token limit reached.",
    resetAt: data.reset_at ?? null,
  };
}

export function isTokenLimitError(error: unknown): boolean {
  return parseTokenLimitError(error) !== null;
}

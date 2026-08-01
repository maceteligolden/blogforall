import { ensureAccessTokenFresh } from "@/lib/api/token-refresh";

export function readAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

/** Refresh if near expiry, then return the current access token. */
export async function getFreshAccessToken(): Promise<string | null> {
  await ensureAccessTokenFresh();
  return readAccessToken();
}

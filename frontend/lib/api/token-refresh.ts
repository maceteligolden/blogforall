import axios from "axios";
import { API_CONFIG, API_ENDPOINTS } from "./config";
import { useAuthStore } from "../store/auth.store";

/** Refresh access token this many seconds before JWT exp to avoid 401 on long requests. */
const REFRESH_SKEW_SECONDS = 120;

let refreshInFlight: Promise<string | null> | null = null;

function decodeJwtPayload(accessToken: string): { exp?: number } | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const padded = b64 + "=".repeat(padLen);
    const json = JSON.parse(atob(padded)) as unknown;
    return json && typeof json === "object" ? (json as { exp?: number }) : null;
  } catch {
    return null;
  }
}

export function accessTokenNeedsRefresh(accessToken: string | null): boolean {
  if (!accessToken) return false;
  const payload = decodeJwtPayload(accessToken);
  const exp = payload?.exp;
  if (typeof exp !== "number") return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return exp - nowSec < REFRESH_SKEW_SECONDS;
}

/**
 * Single-flight refresh using raw axios (avoids recursion through apiClient interceptors).
 * Returns new access_token or null on failure.
 */
export async function refreshAccessTokenWithLock(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async (): Promise<string | null> => {
    try {
      const refreshToken =
        typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;
      if (!refreshToken) return null;

      const response = await axios.post(`${API_CONFIG.baseURL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        refresh_token: refreshToken,
      });

      const newAccessToken = response.data?.data?.access_token as string | undefined;
      if (typeof window !== "undefined" && newAccessToken) {
        localStorage.setItem("access_token", newAccessToken);
        const rt = localStorage.getItem("refresh_token");
        if (rt) {
          useAuthStore.getState().setTokens(newAccessToken, rt);
        }
      }
      return newAccessToken ?? null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export class SessionRefreshFailedError extends Error {
  constructor() {
    super("Session refresh failed");
    this.name = "SessionRefreshFailedError";
  }
}

/** If access token is missing or near expiry, refresh before API calls or native fetch. */
export async function ensureAccessTokenFresh(): Promise<void> {
  if (typeof window === "undefined") return;
  const access = localStorage.getItem("access_token");
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return;
  if (access && !accessTokenNeedsRefresh(access)) return;

  const newTok = await refreshAccessTokenWithLock();
  if (!newTok) {
    useAuthStore.getState().clearAuth();
    const r = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `/auth/login?redirect=${r}`;
    throw new SessionRefreshFailedError();
  }
}

export function shouldSkipProactiveTokenRefresh(url: string | undefined): boolean {
  if (!url) return false;
  return (
    url.includes("/auth/login") ||
    url.includes("/auth/signup") ||
    url.includes("/auth/refresh") ||
    url.includes("/auth/forgot-password") ||
    url.includes("/auth/verify-reset-code") ||
    url.includes("/auth/reset-password")
  );
}

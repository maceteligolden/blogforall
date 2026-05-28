import axios from "axios";
import { API_CONFIG, API_ENDPOINTS } from "./config";
import { useAuthStore } from "../store/auth.store";

const REFRESH_SKEW_SECONDS = 120;
let refreshInFlight: Promise<string | null> | null = null;

function decodeJwtPayload(accessToken: string): { exp?: number } | null {
  try {
    const parts = accessToken.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padLen = (4 - (b64.length % 4)) % 4;
    const json = JSON.parse(atob(b64 + "=".repeat(padLen))) as { exp?: number };
    return json;
  } catch {
    return null;
  }
}

export function accessTokenNeedsRefresh(accessToken: string | null): boolean {
  if (!accessToken) return false;
  const exp = decodeJwtPayload(accessToken)?.exp;
  if (typeof exp !== "number") return false;
  return exp - Math.floor(Date.now() / 1000) < REFRESH_SKEW_SECONDS;
}

export async function refreshAccessTokenWithLock(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = localStorage.getItem("refresh_token");
      if (!refreshToken) return null;

      const response = await axios.post(`${API_CONFIG.baseURL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        refresh_token: refreshToken,
      });

      const newAccessToken = response.data?.data?.access_token as string | undefined;
      if (newAccessToken) {
        localStorage.setItem("access_token", newAccessToken);
        const rt = localStorage.getItem("refresh_token");
        if (rt) useAuthStore.getState().setTokens(newAccessToken, rt);
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

export async function ensureAccessTokenFresh(): Promise<void> {
  if (typeof window === "undefined") return;
  const access = localStorage.getItem("access_token");
  const refresh = localStorage.getItem("refresh_token");
  if (!access || !refresh) return;
  if (!accessTokenNeedsRefresh(access)) return;
  const next = await refreshAccessTokenWithLock();
  if (!next) throw new Error("Session refresh failed");
}

export function shouldSkipProactiveTokenRefresh(url?: string): boolean {
  if (!url) return false;
  return url.includes("/admin/login") || url.includes("/auth/refresh");
}

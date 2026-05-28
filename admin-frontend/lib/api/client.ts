import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { API_CONFIG } from "./config";
import { useAuthStore } from "../store/auth.store";
import {
  ensureAccessTokenFresh,
  refreshAccessTokenWithLock,
  shouldSkipProactiveTokenRefresh,
} from "./token-refresh";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // #region agent log
    if (typeof window !== "undefined") {
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
        body: JSON.stringify({
          sessionId: "d03c4e",
          runId: "cors-root-cause",
          hypothesisId: "H6",
          location: "admin-frontend/lib/api/client.ts:20",
          message: "API request start",
          data: {
            baseURL: API_CONFIG.baseURL,
            url: config.url ?? null,
            method: config.method ?? null,
            host: window.location.host,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    if (typeof window !== "undefined" && !shouldSkipProactiveTokenRefresh(config.url)) {
      try {
        await ensureAccessTokenFresh();
      } catch {
        return Promise.reject(new Error("Authentication required"));
      }
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    if (config.headers && token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    // #region agent log
    if (typeof window !== "undefined") {
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
        body: JSON.stringify({
          sessionId: "d03c4e",
          runId: "cors-root-cause",
          hypothesisId: "H7",
          location: "admin-frontend/lib/api/client.ts:61",
          message: "API response error",
          data: {
            status: error.response?.status ?? null,
            code: error.code ?? null,
            message: error.message,
            url: originalRequest?.url ?? null,
            method: originalRequest?.method ?? null,
            baseURL: API_CONFIG.baseURL,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const newAccessToken = await refreshAccessTokenWithLock();
        if (newAccessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }
      } catch {
        // fall through
      }
      if (typeof window !== "undefined") {
        useAuthStore.getState().clearAuth();
        const r = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `/login?redirect=${r}`;
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;

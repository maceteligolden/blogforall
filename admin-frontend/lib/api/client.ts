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

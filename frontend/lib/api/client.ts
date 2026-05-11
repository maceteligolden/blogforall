import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { API_CONFIG } from "./config";
import { useAuthStore } from "../store/auth.store";
import {
  ensureAccessTokenFresh,
  refreshAccessTokenWithLock,
  SessionRefreshFailedError,
  shouldSkipProactiveTokenRefresh,
} from "./token-refresh";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

// Request interceptor — proactive refresh, then attach Bearer
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined" && !shouldSkipProactiveTokenRefresh(config.url)) {
      try {
        await ensureAccessTokenFresh();
      } catch (e) {
        if (e instanceof SessionRefreshFailedError) {
          return Promise.reject(new Error("Authentication required"));
        }
        throw e;
      }
    }
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle token refresh
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If error is 401 and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken =
          typeof window !== "undefined" ? localStorage.getItem("refresh_token") : null;

        if (!refreshToken) {
          if (typeof window !== "undefined") {
            useAuthStore.getState().clearAuth();
            const r = encodeURIComponent(window.location.pathname + window.location.search);
            window.location.href = `/auth/login?redirect=${r}`;
          }
          return Promise.reject(error);
        }

        const newAccessToken = await refreshAccessTokenWithLock();

        if (newAccessToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        }

        if (typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
          const r = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/auth/login?redirect=${r}`;
        }
        return Promise.reject(error);
      } catch (refreshError) {
        if (typeof window !== "undefined") {
          useAuthStore.getState().clearAuth();
          const r = encodeURIComponent(window.location.pathname + window.location.search);
          window.location.href = `/auth/login?redirect=${r}`;
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;


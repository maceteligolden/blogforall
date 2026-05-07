import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from "axios";
import { API_CONFIG, API_ENDPOINTS } from "./config";
import { useAuthStore } from "../store/auth.store";

const apiClient: AxiosInstance = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: API_CONFIG.headers,
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (config.data instanceof FormData && config.headers) {
      delete config.headers["Content-Type"];
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

        // Try to refresh token
        const response = await axios.post(`${API_CONFIG.baseURL}${API_ENDPOINTS.AUTH.REFRESH}`, {
          refresh_token: refreshToken,
        });

        if (response.data && response.data.data) {
          const newAccessToken = response.data.data.access_token;

          if (typeof window !== "undefined" && newAccessToken) {
            localStorage.setItem("access_token", newAccessToken);
            const rt = localStorage.getItem("refresh_token");
            if (rt) {
              useAuthStore.getState().setTokens(newAccessToken, rt);
            }
          }

          if (originalRequest.headers && newAccessToken) {
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          }

          return apiClient(originalRequest);
        }
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


export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
};

export const API_ENDPOINTS = {
  ADMIN: {
    LOGIN: "/admin/login",
    LOGOUT: "/admin/logout",
    STATS: "/admin/dashboard/stats",
    PROFILE: "/admin/profile",
    CHANGE_PASSWORD: "/admin/change-password",
    CREATE_USER: "/admin/users",
    LIST_USERS: "/admin/users",
    LIST_BLOGS: "/admin/blogs",
    USER_BLOGS: (userId: string) => `/admin/users/${userId}/blogs`,
    TOKEN_USAGE_SUMMARY: "/admin/token-usage/summary",
    TOKEN_USAGE_DAILY: "/admin/token-usage/daily",
    TOKEN_USAGE_DAILY_BY_USER: "/admin/token-usage/daily-by-user",
  },
  AUTH: {
    REFRESH: "/auth/refresh",
  },
};

export const QUERY_KEYS = {
  ADMIN_STATS: ["admin", "stats"],
  ADMIN_PROFILE: ["admin", "profile"],
  ADMIN_USERS: ["admin", "users"],
  ADMIN_BLOGS: ["admin", "blogs"],
  ADMIN_USER_BLOGS: (userId: string) => ["admin", "users", userId, "blogs"],
  ADMIN_TOKEN_USAGE_SUMMARY: ["admin", "token-usage", "summary"],
  ADMIN_TOKEN_USAGE_DAILY: ["admin", "token-usage", "daily"],
  ADMIN_TOKEN_USAGE_DAILY_BY_USER: ["admin", "token-usage", "daily-by-user"],
};

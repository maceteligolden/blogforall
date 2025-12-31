export const API_CONFIG = {
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1",
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
  },
};

export const API_ENDPOINTS = {
  AUTH: {
    LOGIN: "/auth/login",
    SIGNUP: "/auth/signup",
    LOGOUT: "/auth/logout",
    REFRESH: "/auth/refresh",
    PROFILE: "/auth/profile",
    UPDATE_PROFILE: "/auth/profile",
    CHANGE_PASSWORD: "/auth/change-password",
  },
  BLOGS: {
    CREATE: "/blogs",
    LIST: "/blogs",
    GET_ONE: (id: string) => `/blogs/${id}`,
    GET_BY_SLUG: (slug: string) => `/blogs/slug/${slug}`,
    UPDATE: (id: string) => `/blogs/${id}`,
    DELETE: (id: string) => `/blogs/${id}`,
    PUBLISH: (id: string) => `/blogs/${id}/publish`,
    UNPUBLISH: (id: string) => `/blogs/${id}/unpublish`,
    LIKE: (id: string) => `/blogs/${id}/like`,
    MY_BLOGS: "/blogs/my-blogs",
    UPLOAD_IMAGE: "/blogs/images/upload",
    UPLOAD_IMAGES: "/blogs/images/upload-multiple",
  },
  API_KEYS: {
    CREATE: "/api-keys",
    LIST: "/api-keys",
    DELETE: (accessKeyId: string) => `/api-keys/${accessKeyId}`,
  },
};

export const QUERY_KEYS = {
  AUTH_USER: ["auth", "user"],
  BLOGS: ["blogs"],
  BLOG: (id: string) => ["blogs", id],
  MY_BLOGS: ["blogs", "my-blogs"],
  API_KEYS: ["api-keys"],
};


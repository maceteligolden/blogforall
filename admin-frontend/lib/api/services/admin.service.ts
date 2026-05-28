import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export interface ChangePasswordRequest {
  old_password: string;
  new_password: string;
}

export interface CreateAdminUserRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  role: "admin" | "super_admin";
}

export interface DashboardStats {
  total_users: number;
  total_blogs: number;
  total_platform_admins: number;
  total_token_usage: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AdminUserStatsRow {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  blogs_created: number;
  categories_count: number;
  token_usage: number;
  created_at?: string;
}

export interface AdminBlogRow {
  id: string;
  title: string;
  slug: string;
  status: string;
  site_id: string;
  created_at?: string;
  author: { id: string; email: string; name: string } | null;
}

export interface DailyTokenUsageRow {
  date: string;
  tokens: number;
}

export interface DailyTokenUsageByUserRow {
  date: string;
  user_id: string;
  user_name: string;
  user_email: string;
  tokens: number;
}

export class AdminApiService {
  static login(data: LoginRequest) {
    return apiClient.post(API_ENDPOINTS.ADMIN.LOGIN, data);
  }

  static logout() {
    return apiClient.post(API_ENDPOINTS.ADMIN.LOGOUT);
  }

  static getStats() {
    return apiClient.get(API_ENDPOINTS.ADMIN.STATS);
  }

  static getProfile() {
    return apiClient.get(API_ENDPOINTS.ADMIN.PROFILE);
  }

  static updateProfile(data: UpdateProfileRequest) {
    return apiClient.put(API_ENDPOINTS.ADMIN.PROFILE, data);
  }

  static changePassword(data: ChangePasswordRequest) {
    return apiClient.put(API_ENDPOINTS.ADMIN.CHANGE_PASSWORD, data);
  }

  static createAdminUser(data: CreateAdminUserRequest) {
    return apiClient.post(API_ENDPOINTS.ADMIN.CREATE_USER, data);
  }

  static getUsers(params: { page?: number; limit?: number; search?: string; from?: string; to?: string }) {
    return apiClient.get(API_ENDPOINTS.ADMIN.LIST_USERS, { params });
  }

  static getBlogs(params: { page?: number; limit?: number; search?: string }) {
    return apiClient.get(API_ENDPOINTS.ADMIN.LIST_BLOGS, { params });
  }

  static getBlogsByUser(userId: string, params: { page?: number; limit?: number; search?: string }) {
    return apiClient.get(API_ENDPOINTS.ADMIN.USER_BLOGS(userId), { params });
  }

  static getTokenUsageSummary() {
    return apiClient.get(API_ENDPOINTS.ADMIN.TOKEN_USAGE_SUMMARY);
  }

  static getTokenUsageDaily(params?: { from?: string; to?: string }) {
    return apiClient.get(API_ENDPOINTS.ADMIN.TOKEN_USAGE_DAILY, { params });
  }

  static getTokenUsageDailyByUser(params?: { from?: string; to?: string }) {
    return apiClient.get(API_ENDPOINTS.ADMIN.TOKEN_USAGE_DAILY_BY_USER, { params });
  }
}

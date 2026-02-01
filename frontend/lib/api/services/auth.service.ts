import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupRequest {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
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

export class AuthService {
  static async login(data: LoginRequest) {
    return apiClient.post(API_ENDPOINTS.AUTH.LOGIN, data);
  }

  static async signup(data: SignupRequest) {
    return apiClient.post(API_ENDPOINTS.AUTH.SIGNUP, data);
  }

  static async logout() {
    return apiClient.post(API_ENDPOINTS.AUTH.LOGOUT);
  }

  static async refreshToken(refreshToken: string) {
    return apiClient.post(API_ENDPOINTS.AUTH.REFRESH, { refresh_token: refreshToken });
  }

  static async getProfile() {
    return apiClient.get(API_ENDPOINTS.AUTH.PROFILE);
  }

  static async updateProfile(data: UpdateProfileRequest) {
    return apiClient.put(API_ENDPOINTS.AUTH.UPDATE_PROFILE, data);
  }

  static async changePassword(data: ChangePasswordRequest) {
    return apiClient.put(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
  }

  static async updateSiteContext(siteId: string) {
    return apiClient.put(API_ENDPOINTS.AUTH.UPDATE_SITE_CONTEXT, { site_id: siteId });
  }
}


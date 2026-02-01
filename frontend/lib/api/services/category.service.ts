import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent?: string;
  color?: string;
  site_id?: string; // Optional, will use currentSiteId from token if not provided
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active?: boolean;
  site_id?: string; // Optional, will use currentSiteId from token if not provided
}

export interface Category {
  _id: string;
  site_id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CategoryTreeItem extends Category {
  children?: CategoryTreeItem[];
}

export class CategoryService {
  /**
   * Get current site ID from auth store
   */
  private static getCurrentSiteId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return useAuthStore.getState().currentSiteId || undefined;
  }

  static async createCategory(data: CreateCategoryRequest) {
    // Include site_id if not already provided
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.post(API_ENDPOINTS.CATEGORIES.CREATE, requestData);
  }

  static async getCategories(params?: { tree?: boolean; include_inactive?: boolean }) {
    // Backend will filter by currentSiteId from token
    return apiClient.get(API_ENDPOINTS.CATEGORIES.LIST, { params });
  }

  static async getCategoryById(id: string) {
    // Backend will filter by currentSiteId from token
    return apiClient.get(API_ENDPOINTS.CATEGORIES.GET_ONE(id));
  }

  static async updateCategory(id: string, data: UpdateCategoryRequest) {
    // Include site_id if not already provided
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.put(API_ENDPOINTS.CATEGORIES.UPDATE(id), requestData);
  }

  static async deleteCategory(id: string) {
    // Backend will filter by currentSiteId from token
    return apiClient.delete(API_ENDPOINTS.CATEGORIES.DELETE(id));
  }
}


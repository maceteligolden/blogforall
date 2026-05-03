import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent?: string;
  color?: string;
  site_id?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active?: boolean;
  site_id?: string;
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
  private static getCurrentSiteId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return useAuthStore.getState().currentSiteId || undefined;
  }

  private static requireSiteId(): string {
    const siteId = this.getCurrentSiteId();
    if (!siteId) {
      throw new Error("No workspace selected. Choose a site before managing categories.");
    }
    return siteId;
  }

  static async createCategory(data: CreateCategoryRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.post(API_ENDPOINTS.CATEGORIES.CREATE(siteId), body);
  }

  static async getCategories(params?: { tree?: boolean; include_inactive?: boolean }) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CATEGORIES.LIST(siteId), { params });
  }

  static async getCategoryById(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CATEGORIES.GET_ONE(siteId, id));
  }

  static async updateCategory(id: string, data: UpdateCategoryRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.put(API_ENDPOINTS.CATEGORIES.UPDATE(siteId, id), body);
  }

  static async deleteCategory(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.delete(API_ENDPOINTS.CATEGORIES.DELETE(siteId, id));
  }

  static async importCategories(sourceSiteId: string, targetSiteId: string, categoryIds: string[]) {
    const siteId = this.requireSiteId();
    const response = await apiClient.post(API_ENDPOINTS.CATEGORIES.IMPORT(siteId), {
      source_site_id: sourceSiteId,
      target_site_id: targetSiteId,
      category_ids: categoryIds,
    });
    return response.data?.data || response.data;
  }
}

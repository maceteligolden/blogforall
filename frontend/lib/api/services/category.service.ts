import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface CreateCategoryRequest {
  name: string;
  description?: string;
  parent?: string;
  color?: string;
}

export interface UpdateCategoryRequest {
  name?: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active?: boolean;
}

export interface Category {
  _id: string;
  user: string;
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
  static async createCategory(data: CreateCategoryRequest) {
    return apiClient.post(API_ENDPOINTS.CATEGORIES.CREATE, data);
  }

  static async getCategories(params?: { tree?: boolean; include_inactive?: boolean }) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES.LIST, { params });
  }

  static async getCategoryById(id: string) {
    return apiClient.get(API_ENDPOINTS.CATEGORIES.GET_ONE(id));
  }

  static async updateCategory(id: string, data: UpdateCategoryRequest) {
    return apiClient.put(API_ENDPOINTS.CATEGORIES.UPDATE(id), data);
  }

  static async deleteCategory(id: string) {
    return apiClient.delete(API_ENDPOINTS.CATEGORIES.DELETE(id));
  }
}


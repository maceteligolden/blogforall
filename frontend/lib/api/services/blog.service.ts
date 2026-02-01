import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";

export interface CreateBlogRequest {
  title: string;
  content: string;
  content_type?: "html" | "markdown";
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status?: "draft" | "published" | "unpublished";
  category?: string;
  dynamic_forms?: Record<string, unknown>;
  meta?: {
    description?: string;
    keywords?: string[];
  };
  site_id?: string; // Optional, will use currentSiteId from token if not provided
}

export interface UpdateBlogRequest extends Partial<CreateBlogRequest> {
  site_id?: string; // Optional, will use currentSiteId from token if not provided
}

export interface BlogQueryParams {
  status?: "draft" | "published" | "unpublished";
  search?: string;
  page?: number;
  limit?: number;
}

export class BlogService {
  /**
   * Get current site ID from auth store
   */
  private static getCurrentSiteId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return useAuthStore.getState().currentSiteId || undefined;
  }

  static async createBlog(data: CreateBlogRequest) {
    // Include site_id if not already provided
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.post(API_ENDPOINTS.BLOGS.CREATE, requestData);
  }

  static async getBlogById(id: string) {
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_ONE(id));
  }

  static async getUserBlogs(params?: BlogQueryParams) {
    // Backend will filter by currentSiteId from token
    return apiClient.get(API_ENDPOINTS.BLOGS.MY_BLOGS, { params });
  }

  static async getAllBlogs(params?: BlogQueryParams) {
    // Backend will filter by currentSiteId from token
    return apiClient.get(API_ENDPOINTS.BLOGS.LIST, { params });
  }

  static async getBlogBySlug(slug: string) {
    // Backend will filter by currentSiteId from token
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_BY_SLUG(slug));
  }

  static async updateBlog(id: string, data: UpdateBlogRequest) {
    // Include site_id if not already provided
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.put(API_ENDPOINTS.BLOGS.UPDATE(id), requestData);
  }

  static async deleteBlog(id: string) {
    return apiClient.delete(API_ENDPOINTS.BLOGS.DELETE(id));
  }

  static async publishBlog(id: string) {
    return apiClient.post(API_ENDPOINTS.BLOGS.PUBLISH(id));
  }

  static async unpublishBlog(id: string) {
    return apiClient.post(API_ENDPOINTS.BLOGS.UNPUBLISH(id));
  }

  static async toggleLike(id: string) {
    return apiClient.post(API_ENDPOINTS.BLOGS.LIKE(id));
  }

  static async uploadImage(file: File) {
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.post(API_ENDPOINTS.BLOGS.UPLOAD_IMAGE, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      timeout: 60000, // 60 seconds for file uploads
    });
  }

  static async uploadMultipleImages(files: File[]) {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });
    return apiClient.post(API_ENDPOINTS.BLOGS.UPLOAD_IMAGES, formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
  }
}


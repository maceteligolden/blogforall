import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";
import type { ContentBlock } from "@/lib/types/blog";

export interface CreateBlogRequest {
  title: string;
  content: string;
  content_type?: "html" | "markdown";
  content_blocks?: ContentBlock[];
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
  site_id?: string;
}

export interface UpdateBlogRequest extends Partial<CreateBlogRequest> {
  site_id?: string;
}

export interface BlogQueryParams {
  status?: "draft" | "published" | "unpublished";
  search?: string;
  page?: number;
  limit?: number;
}

export class BlogService {
  private static getCurrentSiteId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return useAuthStore.getState().currentSiteId || undefined;
  }

  private static requireSiteId(): string {
    const siteId = this.getCurrentSiteId();
    if (!siteId) {
      throw new Error("No workspace selected. Choose a site before managing blogs.");
    }
    return siteId;
  }

  static async createBlog(data: CreateBlogRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.post(API_ENDPOINTS.BLOGS.CREATE(siteId), body);
  }

  static async getBlogById(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_ONE(siteId, id));
  }

  static async getUserBlogs(params?: BlogQueryParams) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.BLOGS.MY_BLOGS(siteId), { params });
  }

  static async getAllBlogs(params?: BlogQueryParams) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.BLOGS.LIST(siteId), { params });
  }

  static async getBlogBySlug(slug: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_BY_SLUG(siteId, slug));
  }

  static async updateBlog(id: string, data: UpdateBlogRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.put(API_ENDPOINTS.BLOGS.UPDATE(siteId, id), body);
  }

  static async deleteBlog(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.delete(API_ENDPOINTS.BLOGS.DELETE(siteId, id));
  }

  static async publishBlog(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.BLOGS.PUBLISH(siteId, id));
  }

  static async unpublishBlog(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.BLOGS.UNPUBLISH(siteId, id));
  }

  static async toggleLike(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.BLOGS.LIKE(siteId, id));
  }

  static async uploadImage(file: File) {
    const siteId = this.requireSiteId();
    const formData = new FormData();
    formData.append("image", file);
    return apiClient.post(API_ENDPOINTS.BLOGS.UPLOAD_IMAGE(siteId), formData, {
      timeout: 60000,
    });
  }

  static async uploadMultipleImages(files: File[]) {
    const siteId = this.requireSiteId();
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("images", file);
    });
    return apiClient.post(API_ENDPOINTS.BLOGS.UPLOAD_IMAGES(siteId), formData);
  }

  static async scheduleBlog(id: string, scheduled_at: Date, timezone?: string) {
    const siteId = this.requireSiteId();
    const requestData: { scheduled_at: Date; timezone?: string } = {
      scheduled_at,
      ...(timezone && { timezone }),
    };
    return apiClient.post(API_ENDPOINTS.BLOGS.SCHEDULE(siteId, id), requestData);
  }

  static async getBlogSchedule(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_SCHEDULE(siteId, id));
  }

  static async unscheduleBlog(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.delete(API_ENDPOINTS.BLOGS.UNSCHEDULE(siteId, id));
  }
}

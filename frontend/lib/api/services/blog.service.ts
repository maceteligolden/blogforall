import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface CreateBlogRequest {
  title: string;
  content: string;
  content_type?: "html" | "markdown";
  excerpt?: string;
  featured_image?: string;
  images?: string[];
  status?: "draft" | "published" | "unpublished";
  dynamic_forms?: Record<string, unknown>;
  meta?: {
    description?: string;
    keywords?: string[];
  };
}

export interface UpdateBlogRequest extends Partial<CreateBlogRequest> {}

export interface BlogQueryParams {
  status?: "draft" | "published" | "unpublished";
  search?: string;
  page?: number;
  limit?: number;
}

export class BlogService {
  static async createBlog(data: CreateBlogRequest) {
    return apiClient.post(API_ENDPOINTS.BLOGS.CREATE, data);
  }

  static async getBlogById(id: string) {
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_ONE(id));
  }

  static async getUserBlogs(params?: BlogQueryParams) {
    return apiClient.get(API_ENDPOINTS.BLOGS.MY_BLOGS, { params });
  }

  static async getAllBlogs(params?: BlogQueryParams) {
    return apiClient.get(API_ENDPOINTS.BLOGS.LIST, { params });
  }

  static async getBlogBySlug(slug: string) {
    return apiClient.get(API_ENDPOINTS.BLOGS.GET_BY_SLUG(slug));
  }

  static async updateBlog(id: string, data: UpdateBlogRequest) {
    return apiClient.put(API_ENDPOINTS.BLOGS.UPDATE(id), data);
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


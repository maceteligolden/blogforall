import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface CreateCommentRequest {
  blog: string;
  author_name: string;
  author_email?: string;
  content: string;
  parent_comment?: string;
}

export interface Comment {
  _id: string;
  blog: string;
  author_name: string;
  author_email?: string;
  author_id?: string;
  content: string;
  parent_comment?: string;
  is_approved: boolean;
  likes: number;
  liked_by: string[];
  created_at: string;
  updated_at: string;
}

export interface CommentQueryParams {
  blog?: string;
  author_id?: string;
  is_approved?: boolean;
  page?: number;
  limit?: number;
}

export class CommentService {
  static async createComment(data: CreateCommentRequest) {
    return apiClient.post(API_ENDPOINTS.COMMENTS.CREATE, data);
  }

  static async getCommentById(id: string) {
    return apiClient.get(API_ENDPOINTS.COMMENTS.GET_ONE(id));
  }

  static async getCommentsByBlog(blogId: string, params?: CommentQueryParams) {
    return apiClient.get(API_ENDPOINTS.COMMENTS.GET_BY_BLOG(blogId), { params });
  }

  static async getCommentReplies(commentId: string) {
    return apiClient.get(API_ENDPOINTS.COMMENTS.GET_REPLIES(commentId));
  }

  static async updateComment(id: string, data: { content?: string }) {
    return apiClient.put(API_ENDPOINTS.COMMENTS.UPDATE(id), data);
  }

  static async deleteComment(id: string) {
    return apiClient.delete(API_ENDPOINTS.COMMENTS.DELETE(id));
  }

  static async toggleLike(id: string) {
    return apiClient.post(API_ENDPOINTS.COMMENTS.LIKE(id));
  }
}


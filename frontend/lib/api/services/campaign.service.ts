import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";

export interface CreateCampaignRequest {
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  start_date: Date | string;
  end_date: Date | string;
  posting_frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  custom_schedule?: string;
  timezone?: string;
  total_posts_planned?: number;
  budget?: number;
  success_metrics?: {
    target_views?: number;
    target_engagement?: number;
    target_conversions?: number;
    kpis?: string[];
  };
  template_id?: string;
  site_id?: string;
}

export interface UpdateCampaignRequest extends Partial<CreateCampaignRequest> {
  status?: "draft" | "active" | "paused" | "completed" | "cancelled";
}

export interface CampaignQueryParams {
  status?: "draft" | "active" | "paused" | "completed" | "cancelled";
  search?: string;
  start_date_from?: string;
  start_date_to?: string;
  page?: number;
  limit?: number;
}

export interface Campaign {
  _id: string;
  user_id: string;
  site_id: string;
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  status: "draft" | "active" | "paused" | "completed" | "cancelled";
  start_date: string;
  end_date: string;
  posting_frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
  custom_schedule?: string;
  timezone: string;
  total_posts_planned?: number;
  posts_published: number;
  budget?: number;
  success_metrics?: {
    target_views?: number;
    target_engagement?: number;
    target_conversions?: number;
    kpis?: string[];
  };
  created_at: string;
  updated_at: string;
}

export interface CampaignWithStats extends Campaign {
  posts_scheduled: number;
  posts_pending: number;
}

export interface CampaignTemplate {
  _id: string;
  name: string;
  type: string;
  description: string;
  default_goal: string;
  default_duration_days: number;
  default_frequency: string;
  default_posts_count: number;
  suggested_topics?: string[];
  content_themes?: string[];
  ai_prompts?: {
    campaign_strategy?: string;
    post_generation?: string;
  };
  metadata?: {
    best_for?: string[];
    industries?: string[];
  };
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduledPostRequest {
  blog_id?: string;
  campaign_id?: string;
  title: string;
  scheduled_at: Date | string;
  timezone?: string;
  auto_generate?: boolean;
  generation_prompt?: string;
  metadata?: {
    campaign_goal?: string;
    target_audience?: string;
    content_theme?: string;
  };
  site_id?: string;
}

export interface ScheduledPost {
  _id: string;
  user_id: string;
  site_id: string;
  blog_id?: string;
  campaign_id?: string;
  title: string;
  scheduled_at: string;
  timezone: string;
  status: "pending" | "scheduled" | "published" | "failed" | "cancelled";
  publish_attempts: number;
  last_attempt_at?: string;
  error_message?: string;
  published_at?: string;
  auto_generate: boolean;
  generation_prompt?: string;
  metadata?: {
    campaign_goal?: string;
    target_audience?: string;
    content_theme?: string;
  };
  created_at: string;
  updated_at: string;
}

export class CampaignService {
  /**
   * Get current site ID from auth store
   */
  private static getCurrentSiteId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return useAuthStore.getState().currentSiteId || undefined;
  }

  // Campaign methods
  static async createCampaign(data: CreateCampaignRequest) {
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.CREATE, requestData);
  }

  static async getCampaigns(params?: CampaignQueryParams) {
    const siteId = this.getCurrentSiteId();
    const queryParams = siteId ? { ...params, site_id: siteId } : params;
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.MY_CAMPAIGNS, { params: queryParams });
  }

  static async getAllCampaigns(params?: CampaignQueryParams) {
    const siteId = this.getCurrentSiteId();
    const queryParams = siteId ? { ...params, site_id: siteId } : params;
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.LIST, { params: queryParams });
  }

  static async getCampaignById(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.GET_ONE(id), {
      params: { site_id: siteId },
    });
  }

  static async getCampaignWithStats(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.GET_STATS(id), {
      params: { site_id: siteId },
    });
  }

  static async updateCampaign(id: string, data: UpdateCampaignRequest) {
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.put(API_ENDPOINTS.CAMPAIGNS.UPDATE(id), requestData);
  }

  static async deleteCampaign(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.delete(API_ENDPOINTS.CAMPAIGNS.DELETE(id), {
      params: { site_id: siteId },
    });
  }

  static async activateCampaign(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.ACTIVATE(id), null, {
      params: { site_id: siteId },
    });
  }

  static async pauseCampaign(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.PAUSE(id), null, {
      params: { site_id: siteId },
    });
  }

  static async cancelCampaign(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.CANCEL(id), null, {
      params: { site_id: siteId },
    });
  }

  // Scheduled Post methods
  static async createScheduledPost(data: CreateScheduledPostRequest) {
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.CREATE, requestData);
  }

  static async getScheduledPosts(params?: {
    campaign_id?: string;
    status?: string;
    scheduled_at_from?: string;
    scheduled_at_to?: string;
  }) {
    const siteId = this.getCurrentSiteId();
    const queryParams = siteId ? { ...params, site_id: siteId } : params;
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.MY_POSTS, {
      params: queryParams,
    });
  }

  static async getAllScheduledPosts(params?: {
    campaign_id?: string;
    status?: string;
    scheduled_at_from?: string;
    scheduled_at_to?: string;
    page?: number;
    limit?: number;
  }) {
    const siteId = this.getCurrentSiteId();
    const queryParams = siteId ? { ...params, site_id: siteId } : params;
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.LIST, {
      params: queryParams,
    });
  }

  static async getScheduledPostById(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.GET_ONE(id), {
      params: { site_id: siteId },
    });
  }

  static async updateScheduledPost(id: string, data: Partial<CreateScheduledPostRequest>) {
    const siteId = data.site_id || this.getCurrentSiteId();
    const requestData = siteId ? { ...data, site_id: siteId } : data;
    return apiClient.put(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.UPDATE(id), requestData);
  }

  static async deleteScheduledPost(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.delete(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.DELETE(id), {
      params: { site_id: siteId },
    });
  }

  static async cancelScheduledPost(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.CANCEL(id), null, {
      params: { site_id: siteId },
    });
  }

  static async moveToCampaign(id: string, campaignId: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.MOVE_TO_CAMPAIGN(id), {
      campaign_id: campaignId,
      site_id: siteId,
    });
  }

  static async removeFromCampaign(id: string) {
    const siteId = this.getCurrentSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.REMOVE_FROM_CAMPAIGN(id), {
      site_id: siteId,
    });
  }

  // Template methods
  static async getCampaignTemplates(params?: { type?: string; is_active?: boolean; industry?: string }) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.TEMPLATES.LIST, { params });
  }

  static async getCampaignTemplateById(id: string) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.TEMPLATES.GET_ONE(id));
  }

  static async getCampaignTemplatesByType(type: string) {
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.TEMPLATES.GET_BY_TYPE(type));
  }
}

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
  private static getCurrentSiteId(): string | undefined {
    if (typeof window === "undefined") return undefined;
    return useAuthStore.getState().currentSiteId || undefined;
  }

  private static requireSiteId(): string {
    const siteId = this.getCurrentSiteId();
    if (!siteId) {
      throw new Error("No workspace selected. Choose a site before managing campaigns.");
    }
    return siteId;
  }

  static async createCampaign(data: CreateCampaignRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.CREATE(siteId), body);
  }

  static async getCampaigns(params?: CampaignQueryParams) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.MY_CAMPAIGNS(siteId), { params });
  }

  static async getAllCampaigns(params?: CampaignQueryParams) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.LIST(siteId), { params });
  }

  static async getCampaignById(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.GET_ONE(siteId, id));
  }

  static async getCampaignWithStats(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.GET_STATS(siteId, id));
  }

  static async updateCampaign(id: string, data: UpdateCampaignRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.put(API_ENDPOINTS.CAMPAIGNS.UPDATE(siteId, id), body);
  }

  static async deleteCampaign(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.delete(API_ENDPOINTS.CAMPAIGNS.DELETE(siteId, id));
  }

  static async activateCampaign(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.ACTIVATE(siteId, id), null);
  }

  static async pauseCampaign(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.PAUSE(siteId, id), null);
  }

  static async cancelCampaign(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.CANCEL(siteId, id), null);
  }

  static async createScheduledPost(data: CreateScheduledPostRequest) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.CREATE(siteId), body);
  }

  static async getScheduledPosts(params?: {
    campaign_id?: string;
    status?: string;
    scheduled_at_from?: string;
    scheduled_at_to?: string;
  }) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.MY_POSTS(siteId), { params });
  }

  static async getAllScheduledPosts(params?: {
    campaign_id?: string;
    status?: string;
    scheduled_at_from?: string;
    scheduled_at_to?: string;
    page?: number;
    limit?: number;
  }) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.LIST(siteId), { params });
  }

  static async getScheduledPostById(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.GET_ONE(siteId, id));
  }

  static async updateScheduledPost(id: string, data: Partial<CreateScheduledPostRequest>) {
    const siteId = data.site_id || this.requireSiteId();
    const { site_id: _s, ...body } = { ...data, site_id: siteId };
    return apiClient.put(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.UPDATE(siteId, id), body);
  }

  static async deleteScheduledPost(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.delete(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.DELETE(siteId, id));
  }

  static async cancelScheduledPost(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.CANCEL(siteId, id), null);
  }

  static async moveToCampaign(id: string, campaignId: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.MOVE_TO_CAMPAIGN(siteId, id), {
      campaign_id: campaignId,
    });
  }

  static async removeFromCampaign(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.SCHEDULED_POSTS.REMOVE_FROM_CAMPAIGN(siteId, id), null);
  }

  static async getCampaignTemplates(params?: { type?: string; is_active?: boolean; industry?: string }) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.TEMPLATES.LIST(siteId), { params });
  }

  static async getCampaignTemplateById(id: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.TEMPLATES.GET_ONE(siteId, id));
  }

  static async getCampaignTemplatesByType(type: string) {
    const siteId = this.requireSiteId();
    return apiClient.get(API_ENDPOINTS.CAMPAIGNS.TEMPLATES.GET_BY_TYPE(siteId, type));
  }
}

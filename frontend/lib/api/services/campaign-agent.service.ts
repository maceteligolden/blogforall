import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import { useAuthStore } from "../../store/auth.store";

export type PostFrequency = "daily" | "weekly" | "biweekly" | "monthly" | "custom";

export interface AgentProposalCampaign {
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  start_date: string;
  end_date: string;
  posting_frequency: PostFrequency;
  timezone?: string;
  total_posts_planned?: number;
}

export interface AgentProposalScheduledPost {
  title: string;
  scheduled_at: string;
  timezone?: string;
  generation_prompt: string;
  content_theme?: string;
}

export interface AgentProposal {
  campaign: AgentProposalCampaign;
  scheduled_posts: AgentProposalScheduledPost[];
}

export interface AgentChatResponse {
  reply: string;
  session_id: string;
  proposal?: AgentProposal;
}

export interface AgentCreateFromProposalResponse {
  campaign: unknown;
  scheduled_posts: unknown[];
}

export class CampaignAgentService {
  private static requireSiteId(): string {
    if (typeof window === "undefined") {
      throw new Error("Campaign agent requires a browser context");
    }
    const siteId = useAuthStore.getState().currentSiteId;
    if (!siteId) {
      throw new Error("No workspace selected. Choose a site before using the campaign agent.");
    }
    return siteId;
  }

  static async chat(params: {
    session_id?: string;
    message: string;
    site_id?: string;
  }): Promise<{ data: AgentChatResponse }> {
    const siteId = params.site_id ?? this.requireSiteId();
    const body = {
      session_id: params.session_id,
      message: params.message,
      site_id: siteId,
    };
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.AGENT_CHAT(siteId), body);
  }

  static async createFromProposal(params: {
    session_id?: string;
    proposal: AgentProposal;
    site_id?: string;
  }): Promise<{ data: AgentCreateFromProposalResponse }> {
    const siteId = params.site_id ?? this.requireSiteId();
    const body = {
      session_id: params.session_id,
      proposal: params.proposal,
    };
    return apiClient.post(API_ENDPOINTS.CAMPAIGNS.AGENT_CREATE_FROM_PROPOSAL(siteId), body);
  }
}

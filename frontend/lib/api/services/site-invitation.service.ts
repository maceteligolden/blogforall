import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export type SiteMemberRole = "owner" | "admin" | "editor" | "viewer";
export type InvitationStatus = "pending" | "accepted" | "rejected" | "expired";

export interface SiteInvitation {
  _id: string;
  site_id: string;
  email: string;
  role: SiteMemberRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface SiteInvitationWithSite extends SiteInvitation {
  site?: {
    _id: string;
    name: string;
    slug: string;
  };
}

export interface CreateInvitationRequest {
  email: string;
  role: SiteMemberRole;
}

export interface AcceptInvitationRequest {
  token: string;
}

export class SiteInvitationService {
  /**
   * Create an invitation for a site
   */
  static async createInvitation(siteId: string, data: CreateInvitationRequest): Promise<SiteInvitation> {
    const response = await apiClient.post(API_ENDPOINTS.SITES.CREATE_INVITATION(siteId), data);
    return response.data?.data || response.data;
  }

  /**
   * Get invitations for a specific site
   */
  static async getSiteInvitations(siteId: string, status?: InvitationStatus): Promise<SiteInvitation[]> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.GET_INVITATIONS(siteId), {
      params: status ? { status } : undefined,
    });
    return response.data?.data || response.data || [];
  }

  /**
   * Get invitations for the authenticated user
   */
  static async getUserInvitations(status?: InvitationStatus): Promise<SiteInvitationWithSite[]> {
    const response = await apiClient.get(API_ENDPOINTS.INVITATIONS.LIST, {
      params: status ? { status } : undefined,
    });
    return response.data?.data || response.data || [];
  }

  /**
   * Accept an invitation by token
   */
  static async acceptInvitation(token: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.INVITATIONS.ACCEPT(token));
  }

  /**
   * Reject an invitation by token
   */
  static async rejectInvitation(token: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.INVITATIONS.REJECT(token));
  }
}

import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface Site {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  owner: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSiteRequest {
  name: string;
  description?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  description?: string;
}

export interface SiteMember {
  _id: string;
  site_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
  user?: {
    _id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

export interface AddMemberRequest {
  user_id: string;
  role: "admin" | "editor" | "viewer";
}

export interface UpdateMemberRoleRequest {
  role: "admin" | "editor" | "viewer";
}

export interface SiteWithMembers extends Site {
  memberCount?: number;
}

export class SiteService {
  /**
   * Get all sites for the authenticated user
   */
  static async getSites(includeMembers = false): Promise<Site[]> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.LIST, {
      params: { include_members: includeMembers },
    });
    return response.data?.data || response.data || [];
  }

  /**
   * Get site by ID
   */
  static async getSiteById(id: string): Promise<Site> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.GET_ONE(id));
    return response.data?.data || response.data;
  }

  /**
   * Create a new site
   */
  static async createSite(data: CreateSiteRequest): Promise<Site> {
    const response = await apiClient.post(API_ENDPOINTS.SITES.CREATE, data);
    return response.data?.data || response.data;
  }

  /**
   * Update site
   */
  static async updateSite(id: string, data: UpdateSiteRequest): Promise<Site> {
    const response = await apiClient.patch(API_ENDPOINTS.SITES.UPDATE(id), data);
    return response.data?.data || response.data;
  }

  /**
   * Delete site
   */
  static async deleteSite(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.SITES.DELETE(id));
  }

  /**
   * Get site members
   */
  static async getSiteMembers(siteId: string): Promise<SiteMember[]> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.GET_MEMBERS(siteId));
    return response.data?.data || response.data || [];
  }

  /**
   * Add a member to a site
   */
  static async addMember(siteId: string, data: AddMemberRequest): Promise<SiteMember> {
    const response = await apiClient.post(API_ENDPOINTS.SITES.ADD_MEMBER(siteId), data);
    return response.data?.data || response.data;
  }

  /**
   * Update member role
   */
  static async updateMemberRole(
    siteId: string,
    userId: string,
    role: "admin" | "editor" | "viewer"
  ): Promise<SiteMember> {
    const response = await apiClient.patch(API_ENDPOINTS.SITES.UPDATE_MEMBER_ROLE(siteId, userId), {
      role,
    });
    return response.data?.data || response.data;
  }

  /**
   * Remove a member from a site
   */
  static async removeMember(siteId: string, userId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.SITES.REMOVE_MEMBER(siteId, userId));
  }
}

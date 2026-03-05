import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import type {
  Site,
  CreateSiteRequest,
  UpdateSiteRequest,
  SiteMember,
  AddMemberRequest,
  UpdateMemberRoleRequest,
  SiteWithMemberCount,
} from "../types/site.types";

export type { Site, CreateSiteRequest, UpdateSiteRequest, SiteMember, AddMemberRequest, UpdateMemberRoleRequest, SiteWithMemberCount } from "../types/site.types";

export class SiteService {
  /**
   * Ensure user has at least one workspace (create default from env if none). Returns created site or null.
   */
  static async ensureDefaultWorkspace(): Promise<{ created: boolean; site: Site | null }> {
    const response = await apiClient.post(API_ENDPOINTS.SITES.ENSURE_DEFAULT);
    const data = response.data?.data ?? response.data;
    return { created: data.created ?? false, site: data.site ?? null };
  }

  /**
   * Get all sites for the authenticated user
   */
  static async getSites(includeMembers = false): Promise<SiteWithMemberCount[]> {
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

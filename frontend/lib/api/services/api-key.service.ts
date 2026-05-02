import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface CreateApiKeyRequest {
  name: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  accessKeyId: string;
  secretKey: string;
  sitePublicId: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  accessKeyId: string;
  secretKey: string;
  sitePublicId: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export class ApiKeyService {
  static async createApiKey(siteId: string, data: CreateApiKeyRequest) {
    return apiClient.post(API_ENDPOINTS.SITES.CREATE_API_KEY(siteId), data);
  }

  static async getApiKeys(siteId: string) {
    return apiClient.get(API_ENDPOINTS.SITES.LIST_API_KEYS(siteId));
  }

  static async deleteApiKey(siteId: string, accessKeyId: string) {
    return apiClient.delete(API_ENDPOINTS.SITES.DELETE_API_KEY(siteId, accessKeyId));
  }
}

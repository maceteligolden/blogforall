import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface CreateApiKeyRequest {
  name: string;
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  accessKeyId: string;
  secretKey: string; // Only returned once on creation
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export interface ApiKeyListItem {
  id: string;
  name: string;
  accessKeyId: string;
  createdAt: string;
  lastUsed?: string;
  isActive: boolean;
}

export class ApiKeyService {
  static async createApiKey(data: CreateApiKeyRequest) {
    return apiClient.post(API_ENDPOINTS.API_KEYS.CREATE, data);
  }

  static async getApiKeys() {
    return apiClient.get(API_ENDPOINTS.API_KEYS.LIST);
  }

  static async deleteApiKey(accessKeyId: string) {
    return apiClient.delete(API_ENDPOINTS.API_KEYS.DELETE(accessKeyId));
  }
}


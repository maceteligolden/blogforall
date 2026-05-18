import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import type { TokenUsageBalance } from "../types/usage.types";

export class UsageService {
  static async getTokenUsage(): Promise<TokenUsageBalance> {
    const response = await apiClient.get(API_ENDPOINTS.USAGE.TOKENS);
    return response.data?.data ?? response.data;
  }
}

import { AxiosError } from "axios";
import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export type BetaAccessContext = {
  first_name: string;
  last_name: string;
  email: string;
  is_approved: boolean;
  rejected: boolean;
};

export type BetaAccessDecision = BetaAccessContext & {
  already_decided: boolean;
};

function extractMessage(err: unknown): string {
  const ax = err as AxiosError<{ message?: string }>;
  return ax.response?.data?.message || ax.message || "Something went wrong.";
}

export class BetaAccessClient {
  static async getContext(token: string): Promise<BetaAccessContext> {
    try {
      const response = await apiClient.get(API_ENDPOINTS.BETA_ACCESS.CONTEXT, { params: { token } });
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }

  static async approve(token: string): Promise<BetaAccessDecision> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.BETA_ACCESS.APPROVE, { token });
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }

  static async reject(token: string): Promise<BetaAccessDecision> {
    try {
      const response = await apiClient.post(API_ENDPOINTS.BETA_ACCESS.REJECT, { token });
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }
}

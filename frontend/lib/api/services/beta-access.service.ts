import axios, { AxiosError } from "axios";
import { API_CONFIG, API_ENDPOINTS } from "../config";

const betaClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: { "Content-Type": "application/json" },
});

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
      const response = await betaClient.get(API_ENDPOINTS.BETA_ACCESS.CONTEXT, { params: { token } });
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }

  static async approve(token: string): Promise<BetaAccessDecision> {
    try {
      const response = await betaClient.post(API_ENDPOINTS.BETA_ACCESS.APPROVE, { token });
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }

  static async reject(token: string): Promise<BetaAccessDecision> {
    try {
      const response = await betaClient.post(API_ENDPOINTS.BETA_ACCESS.REJECT, { token });
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }
}

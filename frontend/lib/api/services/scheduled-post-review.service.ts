import axios, { AxiosError } from "axios";
import { API_CONFIG, API_ENDPOINTS } from "../config";
import type {
  ReviewContext,
  ReviewDecisionResult,
} from "../types/scheduled-post-review.types";

/**
 * Dedicated axios instance for the public review flow. We deliberately do
 * NOT share the dashboard's `apiClient` here: that client attaches the
 * user's JWT and would attempt a proactive refresh, which is wrong on a
 * link a reviewer may open in any browser. The token in the URL is the
 * only credential the backend verifies.
 */
const reviewClient = axios.create({
  baseURL: API_CONFIG.baseURL,
  timeout: API_CONFIG.timeout,
  headers: { "Content-Type": "application/json" },
});

function extractMessage(err: unknown): string {
  const ax = err as AxiosError<{ message?: string }>;
  const apiMessage = ax.response?.data?.message;
  if (apiMessage) return apiMessage;
  if (ax.code === "ECONNREFUSED") {
    return "Could not reach the server. Please try again later.";
  }
  return ax.message || "Something went wrong.";
}

export class ScheduledPostReviewClient {
  /**
   * Load the read-only preview for the linked scheduled post. Safe to call
   * multiple times — the token is not consumed.
   */
  static async getContext(token: string): Promise<ReviewContext> {
    try {
      const response = await reviewClient.get(API_ENDPOINTS.SCHEDULED_POST_REVIEW.CONTEXT(token));
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }

  static async approve(token: string): Promise<ReviewDecisionResult> {
    try {
      const response = await reviewClient.post(API_ENDPOINTS.SCHEDULED_POST_REVIEW.APPROVE(token));
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }

  static async rework(token: string, comments: string): Promise<ReviewDecisionResult> {
    try {
      const response = await reviewClient.post(
        API_ENDPOINTS.SCHEDULED_POST_REVIEW.REWORK(token),
        { comments }
      );
      return response.data?.data ?? response.data;
    } catch (err) {
      throw new Error(extractMessage(err));
    }
  }
}

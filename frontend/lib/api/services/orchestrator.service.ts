import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import type {
  ChatTurnResponse,
  OrchestratorApproval,
  OrchestratorApprovalStatus,
  OrchestratorThread,
  ThreadWithMessages,
} from "../types/orchestrator.types";

/**
 * Tool-bearing orchestrator turns can run the full blog-generation pipeline
 * (research → planner → editor → reviewer), which routinely takes 30-90s and
 * occasionally up to ~2 min for long posts. The shared apiClient default of
 * 30 s aborts those turns even though the backend completes successfully and
 * persists the result; the user just sees "Something went wrong". (debug
 * session H15.)
 */
const ORCHESTRATOR_TURN_TIMEOUT_MS = 180_000;

export class OrchestratorService {
  /**
   * Send one active-mode turn to the orchestrator. Optionally resumes an
   * existing thread; backend assigns one on first turn.
   */
  static async chat(
    siteId: string,
    message: string,
    threadId?: string
  ): Promise<ChatTurnResponse> {
    const response = await apiClient.post(
      API_ENDPOINTS.ORCHESTRATOR.CHAT(siteId),
      {
        message,
        ...(threadId ? { thread_id: threadId } : {}),
      },
      { timeout: ORCHESTRATOR_TURN_TIMEOUT_MS }
    );
    return response.data?.data ?? response.data;
  }

  /**
   * Send one onboarding-mode turn. The backend forces this into the
   * workspace's single canonical onboarding thread regardless of any local id.
   */
  static async onboardingChat(siteId: string, message: string): Promise<ChatTurnResponse> {
    const response = await apiClient.post(
      API_ENDPOINTS.ORCHESTRATOR.ONBOARDING_CHAT(siteId),
      { message },
      { timeout: ORCHESTRATOR_TURN_TIMEOUT_MS }
    );
    return response.data?.data ?? response.data;
  }

  static async listThreads(siteId: string, limit?: number): Promise<OrchestratorThread[]> {
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.THREADS(siteId), {
      params: limit ? { limit: String(limit) } : undefined,
    });
    const data = response.data?.data ?? response.data;
    return data?.threads ?? [];
  }

  static async getThread(siteId: string, threadId: string): Promise<ThreadWithMessages> {
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.THREAD(siteId, threadId));
    return response.data?.data ?? response.data;
  }

  static async listApprovals(
    siteId: string,
    status?: OrchestratorApprovalStatus,
    limit?: number
  ): Promise<OrchestratorApproval[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    if (limit) params.limit = String(limit);
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.APPROVALS(siteId), {
      params,
    });
    const data = response.data?.data ?? response.data;
    return data?.approvals ?? [];
  }

  static async decideApproval(
    siteId: string,
    approvalId: string,
    decision: "approved" | "rejected",
    note?: string
  ): Promise<OrchestratorApproval> {
    const response = await apiClient.post(
      API_ENDPOINTS.ORCHESTRATOR.APPROVAL_DECIDE(siteId, approvalId),
      { decision, ...(note ? { note } : {}) }
    );
    const data = response.data?.data ?? response.data;
    return data?.approval ?? data;
  }
}

import apiClient from "../client";
import { API_ENDPOINTS } from "../config";
import type {
  ChatTurnResponse,
  OrchestratorApproval,
  OrchestratorApprovalStatus,
  OrchestratorChatAttachment,
  OrchestratorChatRequest,
  OrchestratorSessionMode,
  OrchestratorThread,
  SetupInterviewStartResponse,
  ThreadWithMessages,
  WorkspaceKnowledgeSource,
} from "../types/orchestrator.types";
import type { OrchestratorSelectionContext } from "@/lib/types/orchestrator-session.types";

const ORCHESTRATOR_TURN_TIMEOUT_MS = 180_000;

export class OrchestratorService {
  static async chat(
    siteId: string,
    message: string,
    threadId?: string,
    options?: {
      sessionMode?: OrchestratorSessionMode;
      attachments?: OrchestratorChatAttachment[];
      selectionContext?: OrchestratorSelectionContext;
      conversationMode?: boolean;
    }
  ): Promise<ChatTurnResponse> {
    const body: OrchestratorChatRequest = {
      message,
      ...(threadId ? { thread_id: threadId } : {}),
      ...(options?.sessionMode ? { session_mode: options.sessionMode } : {}),
      ...(options?.conversationMode ? { conversation_mode: true } : {}),
      ...(options?.attachments?.length ? { attachments: options.attachments } : {}),
      ...(options?.selectionContext
        ? {
            selection_context: {
              blog_id: options.selectionContext.blogId,
              reference_type: options.selectionContext.referenceType,
              ...(options.selectionContext.referenceType === "highlight" && options.selectionContext.selectedText
                ? { text: options.selectionContext.selectedText }
                : {}),
            },
          }
        : {}),
    };
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.CHAT(siteId), body, {
      timeout: ORCHESTRATOR_TURN_TIMEOUT_MS,
    });
    return response.data?.data ?? response.data;
  }

  static async onboardingChat(siteId: string, message: string): Promise<ChatTurnResponse> {
    const response = await apiClient.post(
      API_ENDPOINTS.ORCHESTRATOR.ONBOARDING_CHAT(siteId),
      { message },
      { timeout: ORCHESTRATOR_TURN_TIMEOUT_MS }
    );
    return response.data?.data ?? response.data;
  }

  static async startOnboardingInterview(siteId: string): Promise<SetupInterviewStartResponse> {
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.ONBOARDING_START(siteId));
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

  static async renameThread(siteId: string, threadId: string, title: string): Promise<OrchestratorThread> {
    const response = await apiClient.patch(API_ENDPOINTS.ORCHESTRATOR.THREAD(siteId, threadId), { title });
    const data = response.data?.data ?? response.data;
    return data?.thread ?? data;
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
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.APPROVAL_DECIDE(siteId, approvalId), {
      decision,
      ...(note ? { note } : {}),
    });
    const data = response.data?.data ?? response.data;
    return data?.approval ?? data;
  }

  static async uploadContextFile(siteId: string, file: File): Promise<OrchestratorChatAttachment> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.CONTEXT_UPLOAD(siteId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    const data = response.data?.data ?? response.data;
    return data?.file ?? data;
  }

  static async listKnowledgeSources(siteId: string): Promise<WorkspaceKnowledgeSource[]> {
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.KNOWLEDGE(siteId));
    const data = response.data?.data ?? response.data;
    return data?.sources ?? [];
  }

  static async uploadKnowledgeSource(siteId: string, file: File): Promise<WorkspaceKnowledgeSource> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.KNOWLEDGE(siteId), formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 60000,
    });
    const data = response.data?.data ?? response.data;
    return data?.source ?? data;
  }

  static async deleteKnowledgeSource(siteId: string, id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.ORCHESTRATOR.KNOWLEDGE_ITEM(siteId, id));
  }

  static async getGoogleDriveAuthUrl(siteId: string): Promise<string | null> {
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.GOOGLE_DRIVE_AUTH(siteId));
    const data = response.data?.data ?? response.data;
    return data?.auth_url ?? null;
  }
}

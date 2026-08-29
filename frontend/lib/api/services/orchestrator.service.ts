import apiClient from "../client";
import { API_CONFIG, API_ENDPOINTS } from "../config";
import { ensureAccessTokenFresh, SessionRefreshFailedError } from "../token-refresh";
import type {
  ChatTurnResponse,
  OpenThreadResponse,
  OrchestratorApproval,
  OrchestratorApprovalStatus,
  OrchestratorChatAttachment,
  OrchestratorChatRequest,
  OrchestratorSessionMode,
  OrchestratorThread,
  SetupInterviewStartResponse,
  ThreadAssociation,
  ThreadFocus,
  ThreadListResponse,
  ThreadWithMessages,
  WorkspaceKnowledgeSource,
} from "../types/orchestrator.types";
import type { OrchestratorSelectionContext } from "@/lib/types/orchestrator-session.types";
import { compactThreadFocus } from "@/lib/writing/compact-thread-focus";

const ORCHESTRATOR_TURN_TIMEOUT_MS = 240_000;

function parseSseBlocks(buffer: string): { events: Array<{ event: string; data: string }>; rest: string } {
  const parts = buffer.split("\n\n");
  const rest = parts.pop() ?? "";
  const events: Array<{ event: string; data: string }> = [];
  for (const block of parts) {
    let event = "message";
    let data = "";
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        data += line.slice(5).trim();
      }
    }
    if (data) {
      events.push({ event, data });
    }
  }
  return { events, rest };
}

function buildChatBody(
  message: string,
  threadId?: string,
  options?: {
    sessionMode?: OrchestratorSessionMode;
    attachments?: OrchestratorChatAttachment[];
    selectionContext?: OrchestratorSelectionContext;
    conversationMode?: boolean;
    focus?: ThreadFocus;
  }
): OrchestratorChatRequest {
  const focus = compactThreadFocus(options?.focus);
  return {
    message,
    ...(threadId ? { thread_id: threadId } : {}),
    session_mode: options?.sessionMode ?? "auto",
    ...(options?.conversationMode ? { conversation_mode: true } : {}),
    ...(focus ? { focus } : {}),
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
}

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
      focus?: ThreadFocus;
    }
  ): Promise<ChatTurnResponse> {
    const body = buildChatBody(message, threadId, options);
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.CHAT(siteId), body, {
      timeout: ORCHESTRATOR_TURN_TIMEOUT_MS,
    });
    return response.data?.data ?? response.data;
  }

  /**
   * Voice call path: full turn then SSE `sentence` events + final `done` payload.
   */
  static async chatStream(
    siteId: string,
    message: string,
    threadId?: string,
    options?: {
      sessionMode?: OrchestratorSessionMode;
      attachments?: OrchestratorChatAttachment[];
      selectionContext?: OrchestratorSelectionContext;
      conversationMode?: boolean;
      focus?: ThreadFocus;
      onSentence?: (text: string) => void;
      signal?: AbortSignal;
    }
  ): Promise<ChatTurnResponse> {
    if (typeof window !== "undefined") {
      try {
        await ensureAccessTokenFresh();
      } catch (e) {
        if (e instanceof SessionRefreshFailedError) throw new Error("Authentication required");
        throw e;
      }
    }
    const url = `${API_CONFIG.baseURL}${API_ENDPOINTS.ORCHESTRATOR.CHAT_STREAM(siteId)}`;
    const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const { getCorrelationHeaders } = await import("@/lib/observability/request-headers");
    const correlation = getCorrelationHeaders();
    const body = buildChatBody(message, threadId, options);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...correlation,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
      signal: options?.signal,
    });

    if (!res.ok) {
      const raw = await res.text();
      let msg = `Chat stream failed (${res.status})`;
      try {
        const j = JSON.parse(raw) as { message?: string };
        if (j?.message) msg = j.message;
      } catch {
        if (raw) msg = raw.slice(0, 200);
      }
      throw new Error(msg);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body from stream");

    const decoder = new TextDecoder();
    let carry = "";
    let finalPayload: ChatTurnResponse | null = null;

    const handleEvent = (ev: { event: string; data: string }) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(ev.data) as unknown;
      } catch {
        parsed = ev.data;
      }
      if (ev.event === "sentence" && parsed && typeof parsed === "object") {
        const text = (parsed as { text?: string }).text;
        if (text?.trim()) options?.onSentence?.(text);
      }
      if (ev.event === "done" && parsed && typeof parsed === "object") {
        finalPayload = parsed as ChatTurnResponse;
      }
    };

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      carry += decoder.decode(value, { stream: true });
      const { events, rest } = parseSseBlocks(carry);
      carry = rest;
      for (const ev of events) handleEvent(ev);
    }

    const tail = parseSseBlocks(carry.endsWith("\n\n") ? carry : `${carry}\n\n`);
    for (const ev of tail.events) handleEvent(ev);

    if (!finalPayload) throw new Error("Stream ended without a done event");
    return finalPayload;
  }

  static async openThread(siteId: string, threadId?: string): Promise<OpenThreadResponse> {
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.THREADS_OPEN(siteId), {
      ...(threadId ? { thread_id: threadId } : {}),
    });
    return response.data?.data ?? response.data;
  }

  static async synthesizeTts(siteId: string, text: string): Promise<Blob> {
    const response = await apiClient.post(
      API_ENDPOINTS.ORCHESTRATOR.VOICE_TTS(siteId),
      { text },
      { responseType: "blob", timeout: 60_000 }
    );
    return response.data as Blob;
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

  static async listThreads(
    siteId: string,
    limit?: number,
    extra?: {
      entity_type?: string;
      entity_id?: string;
      q?: string;
      cursor?: string;
      include_archived?: boolean;
    }
  ): Promise<OrchestratorThread[]> {
    const params: Record<string, string> = {};
    if (limit) params.limit = String(limit);
    if (extra?.entity_type) params.entity_type = extra.entity_type;
    if (extra?.entity_id) params.entity_id = extra.entity_id;
    if (extra?.q) params.q = extra.q;
    if (extra?.cursor) params.cursor = extra.cursor;
    if (extra?.include_archived) params.include_archived = "true";
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.THREADS(siteId), {
      params: Object.keys(params).length ? params : undefined,
    });
    const data = response.data?.data ?? response.data;
    return data?.threads ?? [];
  }

  static async listThreadsPage(
    siteId: string,
    extra?: {
      limit?: number;
      entity_type?: string;
      entity_id?: string;
      q?: string;
      cursor?: string;
      include_archived?: boolean;
    }
  ): Promise<ThreadListResponse> {
    const params: Record<string, string> = {};
    if (extra?.limit) params.limit = String(extra.limit);
    if (extra?.entity_type) params.entity_type = extra.entity_type;
    if (extra?.entity_id) params.entity_id = extra.entity_id;
    if (extra?.q) params.q = extra.q;
    if (extra?.cursor) params.cursor = extra.cursor;
    if (extra?.include_archived) params.include_archived = "true";
    const response = await apiClient.get(API_ENDPOINTS.ORCHESTRATOR.THREADS(siteId), { params });
    const data = (response.data?.data ?? response.data) as ThreadListResponse;
    return { threads: data?.threads ?? [], next_cursor: data?.next_cursor };
  }

  static async createThread(
    siteId: string,
    body?: {
      channel?: "chat" | "call";
      associations?: ThreadAssociation[];
      focus?: ThreadFocus;
    }
  ): Promise<OrchestratorThread> {
    const focus = compactThreadFocus(body?.focus);
    const payload = {
      ...(body ?? {}),
      ...(focus ? { focus } : {}),
    };
    if (!focus && payload && "focus" in payload) {
      delete payload.focus;
    }
    const response = await apiClient.post(API_ENDPOINTS.ORCHESTRATOR.THREADS(siteId), payload);
    const data = response.data?.data ?? response.data;
    return data?.thread ?? data;
  }

  static async deleteThread(siteId: string, threadId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.ORCHESTRATOR.THREAD(siteId, threadId));
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
    note?: string,
    destinations?: string[]
  ): Promise<OrchestratorApproval> {
    const response = await apiClient.post(
      API_ENDPOINTS.ORCHESTRATOR.APPROVAL_DECIDE(siteId, approvalId),
      {
        decision,
        ...(note ? { note } : {}),
        ...(destinations?.length ? { destinations } : {}),
      },
      { timeout: ORCHESTRATOR_TURN_TIMEOUT_MS }
    );
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

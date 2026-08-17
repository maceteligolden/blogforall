"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { getRealtimeClient, REALTIME_EVENTS, type RealtimeClient, type RealtimeEnvelope } from "@/lib/realtime";

interface RealtimeContextValue {
  client: RealtimeClient;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const { accessToken, currentSiteId, isAuthenticated } = useAuthStore();
  const clientRef = useRef(getRealtimeClient());
  const previousSiteId = useRef<string | null>(null);
  const previousToken = useRef<string | null>(null);

  const invalidateCatchUp = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
    void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT });
    if (currentSiteId) {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId) });
    }
  }, [queryClient, currentSiteId]);

  useEffect(() => {
    const client = clientRef.current;
    if (!isAuthenticated || !accessToken) {
      client.disconnect();
      previousToken.current = null;
      return;
    }

    const tokenChanged = previousToken.current !== null && previousToken.current !== accessToken;
    previousToken.current = accessToken;

    if (tokenChanged && client.getStatus() !== "disconnected") {
      void client.updateAuthAndReconnect().then(() => invalidateCatchUp());
      return;
    }

    void client.connect().then(() => {
      invalidateCatchUp();
    });
  }, [isAuthenticated, accessToken, invalidateCatchUp]);

  useEffect(() => {
    const client = clientRef.current;
    if (!isAuthenticated) return;

    const prev = previousSiteId.current;
    if (prev && prev !== currentSiteId) {
      void client.leaveSite(prev);
    }
    if (currentSiteId) {
      void client.joinSite(currentSiteId);
    }
    previousSiteId.current = currentSiteId ?? null;
  }, [currentSiteId, isAuthenticated]);

  useEffect(() => {
    const client = clientRef.current;
    const unsubs = [
      client.on(REALTIME_EVENTS.APPROVAL_CREATED, () => {
        if (currentSiteId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId) });
        }
      }),
      client.on(REALTIME_EVENTS.APPROVAL_DECIDED, () => {
        if (currentSiteId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId) });
        }
      }),
      client.on(REALTIME_EVENTS.CAMPAIGN_EVENT_APPENDED, (envelope: RealtimeEnvelope<{ campaignId?: string }>) => {
        const campaignId = envelope.payload?.campaignId;
        if (campaignId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_EVENTS(campaignId) });
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(campaignId) });
        }
      }),
      client.on(REALTIME_EVENTS.SCHEDULED_POST_PUBLISHED, () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
      }),
      client.on(REALTIME_EVENTS.SCHEDULED_POST_FAILED, () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
        void queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "campaigns" &&
            query.queryKey[2] === "roadmap",
        });
      }),
      client.on(REALTIME_EVENTS.SCHEDULED_POST_PREPARED, (envelope: RealtimeEnvelope<{
        scheduledPostId?: string;
        blogId?: string;
      }>) => {
        const scheduledPostId = envelope.payload?.scheduledPostId;
        const blogId = envelope.payload?.blogId;
        if (scheduledPostId && blogId) {
          queryClient.setQueriesData(
            {
              predicate: (query) =>
                Array.isArray(query.queryKey) &&
                query.queryKey[0] === "campaigns" &&
                query.queryKey[2] === "roadmap",
            },
            (old: unknown) => {
              const payload = old as {
                current?: { items?: Array<{ scheduled_post_id?: string; blog_id?: string; draft_status?: string }> };
              } | undefined;
              if (!payload?.current?.items) return old;
              return {
                ...payload,
                current: {
                  ...payload.current,
                  items: payload.current.items.map((item) =>
                    item.scheduled_post_id === scheduledPostId
                      ? { ...item, blog_id: blogId, draft_status: "draft_ready" }
                      : item
                  ),
                },
              };
            }
          );
        }
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT });
        void queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "campaigns" &&
            query.queryKey[2] === "roadmap",
        });
        if (currentSiteId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ORCHESTRATOR_APPROVALS(currentSiteId) });
        }
      }),
      client.on(REALTIME_EVENTS.BLOG_STATUS_CHANGED, (envelope: RealtimeEnvelope<{ blogId?: string }>) => {
        const blogId = envelope.payload?.blogId;
        if (blogId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(blogId) });
        }
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
        void queryClient.invalidateQueries({
          predicate: (query) =>
            Array.isArray(query.queryKey) &&
            query.queryKey[0] === "campaigns" &&
            query.queryKey[2] === "roadmap",
        });
      }),
      client.on(REALTIME_EVENTS.STRATEGY_STATUS_CHANGED, () => {
        void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
        if (currentSiteId) {
          void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId) });
        }
      }),
    ];
    return () => {
      for (const u of unsubs) u();
    };
  }, [queryClient, currentSiteId]);

  const value = useMemo(() => ({ client: clientRef.current }), []);

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeContextValue {
  const ctx = useContext(RealtimeContext);
  if (!ctx) {
    throw new Error("useRealtime must be used within RealtimeProvider");
  }
  return ctx;
}

export function useRealtimeOptional(): RealtimeContextValue | null {
  return useContext(RealtimeContext);
}

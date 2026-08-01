"use client";

import { createContext, useContext, useCallback, ReactNode } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NotificationService } from "@/lib/api/services/notification.service";
import { QUERY_KEYS } from "@/lib/api/config";
import type { NotificationItem, ListNotificationsResponse } from "@/lib/api/types/notification.types";
import { useRealtimeEvent } from "@/lib/hooks/use-realtime-event";
import { REALTIME_EVENTS, type RealtimeEnvelope } from "@/lib/realtime";

interface NotificationContextType {
  notifications: NotificationItem[];
  unreadCount: number;
  isLoadingList: boolean;
  isLoadingCount: boolean;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  refetch: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const LIST_LIMIT = 20;

interface NotificationCreatedPayload {
  id: string;
  type: string;
  title?: string;
  body?: string;
  payload?: Record<string, unknown>;
  createdAt?: string;
  readAt?: string | null;
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();

  const listQuery = useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS,
    queryFn: () => NotificationService.list({ limit: LIST_LIMIT }),
    select: (res) => res.data ?? [],
  });

  const countQuery = useQuery({
    queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT,
    queryFn: () => NotificationService.getUnreadCount(),
  });

  const markAsReadMutation = useMutation({
    mutationFn: (id: string) => NotificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT });
    },
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => NotificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT });
    },
  });

  const markAsRead = useCallback(
    (id: string) => {
      markAsReadMutation.mutate(id);
    },
    [markAsReadMutation]
  );

  const markAllAsRead = useCallback(() => {
    markAllAsReadMutation.mutate();
  }, [markAllAsReadMutation]);

  const refetch = useCallback(() => {
    listQuery.refetch();
    countQuery.refetch();
  }, [listQuery, countQuery]);

  useRealtimeEvent(REALTIME_EVENTS.NOTIFICATION_CREATED, (envelope: RealtimeEnvelope<NotificationCreatedPayload>) => {
    const payload = envelope.payload;
    if (!payload?.id) return;

    const item: NotificationItem = {
      _id: payload.id,
      type: payload.type,
      channel: "in_app",
      title: payload.title,
      body: payload.body,
      payload: payload.payload,
      read_at: payload.readAt ?? null,
      created_at: payload.createdAt ?? envelope.ts,
      updated_at: payload.createdAt ?? envelope.ts,
    };

    queryClient.setQueryData(QUERY_KEYS.NOTIFICATIONS, (prev: unknown) => {
      if (prev && typeof prev === "object" && "data" in (prev as object)) {
        const res = prev as ListNotificationsResponse;
        if (res.data.some((n) => n._id === item._id)) return prev;
        return {
          ...res,
          data: [item, ...res.data].slice(0, LIST_LIMIT),
        };
      }
      return prev;
    });

    queryClient.setQueryData(QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT, (prev: unknown) => {
      if (typeof prev === "number") return prev + 1;
      return prev;
    });
  });

  const value: NotificationContextType = {
    notifications: Array.isArray(listQuery.data) ? listQuery.data : [],
    unreadCount: countQuery.data ?? 0,
    isLoadingList: listQuery.isLoading,
    isLoadingCount: countQuery.isLoading,
    markAsRead,
    markAllAsRead,
    refetch,
  };

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

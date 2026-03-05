"use client";

import {
  createContext,
  useContext,
  useCallback,
  ReactNode,
} from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { NotificationService } from "@/lib/api/services/notification.service";
import { QUERY_KEYS } from "@/lib/api/config";
import type { NotificationItem } from "@/lib/api/types/notification.types";

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

  const value: NotificationContextType = {
    notifications: Array.isArray(listQuery.data) ? listQuery.data : [],
    unreadCount: countQuery.data ?? 0,
    isLoadingList: listQuery.isLoading,
    isLoadingCount: countQuery.isLoading,
    markAsRead,
    markAllAsRead,
    refetch,
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return context;
}

"use client";

import { useQuery } from "@tanstack/react-query";
import {
  AdminApiService,
  DailyTokenUsageByUserRow,
  DailyTokenUsageRow,
} from "../api/services/admin.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useAdminTokenUsageSummary() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: QUERY_KEYS.ADMIN_TOKEN_USAGE_SUMMARY,
    queryFn: async () => {
      const res = await AdminApiService.getTokenUsageSummary();
      return res.data.data as { total_token_usage: number };
    },
    enabled: isAuthenticated,
  });
}

export function useAdminTokenUsageDaily(params?: { from?: string; to?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: [...QUERY_KEYS.ADMIN_TOKEN_USAGE_DAILY, params],
    queryFn: async () => {
      const res = await AdminApiService.getTokenUsageDaily(params);
      return res.data.data as DailyTokenUsageRow[];
    },
    enabled: isAuthenticated,
  });
}

export function useAdminTokenUsageDailyByUser(params?: { from?: string; to?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: [...QUERY_KEYS.ADMIN_TOKEN_USAGE_DAILY_BY_USER, params],
    queryFn: async () => {
      const res = await AdminApiService.getTokenUsageDailyByUser(params);
      return res.data.data as DailyTokenUsageByUserRow[];
    },
    enabled: isAuthenticated,
  });
}

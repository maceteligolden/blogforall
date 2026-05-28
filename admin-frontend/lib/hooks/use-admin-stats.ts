"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminApiService, DashboardStats } from "../api/services/admin.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useAdminStats() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: QUERY_KEYS.ADMIN_STATS,
    queryFn: async () => {
      const res = await AdminApiService.getStats();
      return res.data.data as DashboardStats;
    },
    enabled: isAuthenticated,
  });
}

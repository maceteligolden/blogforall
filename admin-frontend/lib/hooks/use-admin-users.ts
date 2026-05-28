"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminApiService, AdminUserStatsRow, PaginationMeta } from "../api/services/admin.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useAdminUsers(params: {
  page?: number;
  limit?: number;
  search?: string;
  from?: string;
  to?: string;
}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: [...QUERY_KEYS.ADMIN_USERS, params],
    queryFn: async () => {
      const res = await AdminApiService.getUsers(params);
      return res.data.data as {
        data: AdminUserStatsRow[];
        pagination: PaginationMeta;
      };
    },
    enabled: isAuthenticated,
  });
}

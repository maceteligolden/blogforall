"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminApiService, AdminBlogRow, PaginationMeta } from "../api/services/admin.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useAdminBlogs(params: { page?: number; limit?: number; search?: string }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: [...QUERY_KEYS.ADMIN_BLOGS, params],
    queryFn: async () => {
      const res = await AdminApiService.getBlogs(params);
      return res.data.data as {
        data: AdminBlogRow[];
        pagination: PaginationMeta;
      };
    },
    enabled: isAuthenticated,
  });
}

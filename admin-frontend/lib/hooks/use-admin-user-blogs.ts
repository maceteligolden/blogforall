"use client";

import { useQuery } from "@tanstack/react-query";
import { AdminApiService, AdminBlogRow, PaginationMeta } from "../api/services/admin.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useAdminUserBlogs(
  userId: string,
  params: { page?: number; limit?: number; search?: string }
) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return useQuery({
    queryKey: [...QUERY_KEYS.ADMIN_USER_BLOGS(userId), params],
    queryFn: async () => {
      const res = await AdminApiService.getBlogsByUser(userId, params);
      return res.data.data as {
        data: AdminBlogRow[];
        pagination: PaginationMeta;
      };
    },
    enabled: isAuthenticated && !!userId,
  });
}

"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/api/config";
import { UsageService } from "@/lib/api/services/usage.service";
import { useAuthStore } from "@/lib/store/auth.store";

export function useTokenUsage() {
  const { isAuthenticated } = useAuthStore();

  return useQuery({
    queryKey: QUERY_KEYS.TOKEN_USAGE,
    queryFn: () => UsageService.getTokenUsage(),
    enabled: isAuthenticated,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });
}

export function useInvalidateTokenUsage() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TOKEN_USAGE });
}

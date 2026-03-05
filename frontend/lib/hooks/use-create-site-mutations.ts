"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SiteService } from "@/lib/api/services/site.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/api/config";
import type { CreateSiteRequest } from "@/lib/api/types/site.types";

interface UseCreateSiteMutationsOptions {
  onError?: (message: string) => void;
}

export function useCreateSiteMutations(options: UseCreateSiteMutationsOptions = {}) {
  const { onError } = options;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { updateSiteContext } = useAuth();

  const skipMutation = useMutation({
    mutationFn: () => SiteService.ensureDefaultWorkspace(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      router.push("/onboarding/invite");
    },
    onError: (err: unknown) => {
      const apiMessage = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      onError?.(apiMessage ?? "Could not create default workspace. Please create one above.");
    },
  });

  const createSiteMutation = useMutation({
    mutationFn: (data: CreateSiteRequest) => SiteService.createSite(data),
    onSuccess: async (newSite) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      updateSiteContext(newSite._id);
      router.push("/onboarding/invite");
    },
    onError: (err: unknown) => {
      const res = err as { response?: { data?: { message?: string } }; code?: string; message?: string };
      const apiMessage = res?.response?.data?.message;
      const message =
        apiMessage ??
        (res?.code === "ECONNREFUSED" || res?.message?.includes("Network")
          ? "Cannot reach server. Please check that the backend is running."
          : "Failed to create site");
      onError?.(message);
    },
  });

  return { skipMutation, createSiteMutation };
}

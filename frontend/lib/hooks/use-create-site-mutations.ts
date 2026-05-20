"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SiteService } from "@/lib/api/services/site.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/api/config";
import type { CreateSiteRequest, Site } from "@/lib/api/types/site.types";
import { workspaceTracker } from "@/lib/analytics/flows/workspace.tracker";

interface UseCreateSiteMutationsOptions {
  onError?: (message: string) => void;
  /**
   * Called after a site is successfully created (either by createSiteMutation
   * or skipMutation). The create-site page uses this to transition into the
   * orchestrator-led onboarding chat instead of routing away. When omitted,
   * the legacy behaviour of pushing straight to /onboarding/invite is used.
   */
  onSiteReady?: (site: Site) => void;
}

export function useCreateSiteMutations(options: UseCreateSiteMutationsOptions = {}) {
  const { onError, onSiteReady } = options;
  const queryClient = useQueryClient();
  const router = useRouter();
  const { updateSiteContext } = useAuth();

  const skipMutation = useMutation({
    mutationFn: () => SiteService.ensureDefaultWorkspace(),
    onSuccess: async ({ site }) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      if (site) {
        workspaceTracker.created({ workspace_name: site.name });
        updateSiteContext(site._id);
        if (onSiteReady) {
          onSiteReady(site);
          return;
        }
      }
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
      workspaceTracker.created({ workspace_name: newSite.name });
      updateSiteContext(newSite._id);
      if (onSiteReady) {
        onSiteReady(newSite);
        return;
      }
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

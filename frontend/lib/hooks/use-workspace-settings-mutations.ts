"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SiteService } from "@/lib/api/services/site.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import type { UpdateSiteRequest } from "@/lib/api/types/site.types";

export function useWorkspaceSettingsMutations(siteId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { currentSiteId, setCurrentSiteId } = useAuthStore();

  const updateMutation = useMutation({
    mutationFn: (data: UpdateSiteRequest) => SiteService.updateSite(siteId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.SITE(siteId), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => SiteService.deleteSite(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      if (currentSiteId === siteId) {
        setCurrentSiteId(null);
      }
      router.push("/dashboard/sites");
    },
  });

  return { updateMutation, deleteMutation };
}

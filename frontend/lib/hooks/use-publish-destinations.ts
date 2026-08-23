import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QUERY_KEYS } from "@/lib/api/config";
import { IntegrationService } from "@/lib/api/services/integration.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { defaultDestinationSelection, hasExternalCms } from "@/components/integrations/publish-destination-picker";

export function usePublishDestinations() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const query = useQuery({
    queryKey: currentSiteId
      ? QUERY_KEYS.INTEGRATION_DESTINATIONS(currentSiteId)
      : ["integrations", "destinations", "none"],
    queryFn: () => IntegrationService.listDestinations(currentSiteId as string),
    enabled: !!currentSiteId,
    staleTime: 30_000,
  });
  const destinations = useMemo(() => query.data ?? [{ provider: "bloggr", label: "Bloggr" }], [query.data]);
  const [selected, setSelected] = useState<string[]>(() => defaultDestinationSelection(destinations));

  useEffect(() => {
    setSelected((prev) => defaultDestinationSelection(destinations, prev));
  }, [destinations]);

  return {
    ...query,
    destinations,
    hasCms: hasExternalCms(destinations),
    selected,
    setSelected,
  };
}

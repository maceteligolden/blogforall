"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SiteService } from "@/lib/api/services/site.service";
import {
  StrategicService,
  isContentStrategyReady,
  type WorkspaceStrategy,
} from "@/lib/api/services/strategic.service";
import { ContentStrategyEditor, generationBanner } from "@/components/strategy/content-strategy-editor";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import Link from "next/link";

export default function StrategyBoardPage() {
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: strategy, isLoading } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId) : [],
    queryFn: () => StrategicService.getStrategy(currentSiteId as string),
    enabled: !!currentSiteId,
    refetchInterval: (q) => (q.state.data?.generation_status === "generating" ? 4000 : false),
  });

  const { data: site } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.SITE(currentSiteId) : [],
    queryFn: () => SiteService.getSiteById(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<WorkspaceStrategy>) =>
      StrategicService.updateStrategy(currentSiteId as string, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId as string) });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: (websiteUrl: string) =>
      StrategicService.regenerateStrategy(currentSiteId as string, websiteUrl),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId as string), data);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId as string) });
    },
  });

  if (!currentSiteId) {
    return <div className="p-6 sm:p-8 text-gray-400">Select a workspace to view Content Strategy.</div>;
  }

  const banner = generationBanner(strategy?.generation_status, strategy?.generation_error);
  const savedUrl = strategy?.website_url || site?.website_url;
  const missingUrl = strategy && !savedUrl && strategy.generation_status !== "generating";
  const generating = regenerateMutation.isPending || strategy?.generation_status === "generating";

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <Breadcrumb items={[{ label: "Dashboard" }, { label: "Content Strategy" }]} />
        <div className="mt-4 mb-6">
          <h1 className="text-2xl sm:text-3xl font-display">Content Strategy</h1>
          <p className="text-gray-400 text-sm mt-1 max-w-2xl">
            Inspect and edit the editorial constitution. Chat is how you confirm it and start writing.
          </p>
        </div>

        {banner && (
          <div
            className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
              strategy?.generation_status === "failed"
                ? "border-red-800 bg-red-900/20 text-red-200"
                : "border-primary/40 bg-primary/10"
            }`}
          >
            {banner}
          </div>
        )}

        {missingUrl && (
          <div className="mb-4 rounded-lg border border-amber-800 bg-amber-900/20 px-4 py-3 text-sm text-amber-100">
            Add a website URL and generate, or fill the editor manually. Campaigns stay locked until Content Strategy is
            ready.
          </div>
        )}

        {isLoading && <p className="text-gray-500">Loading Content Strategy…</p>}

        {strategy && (
          <div className="space-y-4">
            <ContentStrategyEditor
              key={`${strategy._id ?? "cs"}-${strategy.version}-${strategy.generation_status}`}
              strategy={strategy}
              fallbackWebsiteUrl={site?.website_url}
              saving={saveMutation.isPending}
              generating={generating}
              onSave={(patch) => saveMutation.mutate(patch)}
              onGenerate={(websiteUrl) => regenerateMutation.mutate(websiteUrl)}
            />
            {isContentStrategyReady(strategy) && (
              <p className="text-sm text-gray-400 pb-8">
                Ready to write.{" "}
                <Link href="/dashboard" className="text-primary hover:underline">
                  Open chat
                </Link>{" "}
                to start a post from this strategy.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

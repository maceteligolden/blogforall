"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CampaignService } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { Button } from "@/components/ui/button";

export function CampaignRoadmapTab({ campaignId }: { campaignId: string }) {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId),
    queryFn: async () => {
      const res = await CampaignService.getRoadmap(campaignId);
      return res.data.data as {
        current?: {
          status: string;
          version: number;
          summary: string;
          items: Array<{
            title: string;
            objective: string;
            strategic_intent: string;
            narrative_phase?: string;
            scheduled_at?: string;
            sequence_index: number;
          }>;
        };
      };
    },
  });

  const planMutation = useMutation({
    mutationFn: () => CampaignService.planCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(campaignId) });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => CampaignService.approveRoadmap(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
    },
  });

  const roadmap = data?.current;

  if (isLoading) {
    return <p className="text-gray-400 py-8 text-center">Loading roadmap…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          className="bg-primary hover:bg-primary/90 text-white"
          onClick={() => planMutation.mutate()}
          disabled={planMutation.isPending}
        >
          {planMutation.isPending ? "Generating…" : roadmap ? "Regenerate roadmap" : "Generate roadmap"}
        </Button>
        {roadmap?.status === "proposed" && (
          <Button
            className="bg-green-600 hover:bg-green-700 text-white"
            onClick={() => approveMutation.mutate()}
            disabled={approveMutation.isPending}
          >
            {approveMutation.isPending ? "Approving…" : "Approve roadmap"}
          </Button>
        )}
      </div>

      {!roadmap ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-800">
          <p className="text-gray-400 mb-2">No roadmap yet.</p>
          <p className="text-sm text-gray-500">Generate a strategic content plan from your campaign goal and dates.</p>
        </div>
      ) : (
        <>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-white">v{roadmap.version}</h3>
              <span className="text-xs px-2 py-0.5 rounded border border-gray-700 text-gray-400 capitalize">
                {roadmap.status}
              </span>
            </div>
            <p className="text-gray-300 text-sm">{roadmap.summary}</p>
          </div>
          <div className="space-y-3">
            {roadmap.items.map((item) => (
              <div
                key={item.sequence_index}
                className="bg-black rounded-lg border border-gray-800 p-4"
              >
                <div className="flex justify-between gap-4 mb-2">
                  <h4 className="font-medium text-white">{item.title}</h4>
                  {item.scheduled_at && (
                    <span className="text-xs text-gray-500 shrink-0">
                      {new Date(item.scheduled_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-400">{item.objective}</p>
                {item.narrative_phase && (
                  <span className="inline-block mt-2 text-xs text-primary capitalize">
                    {item.narrative_phase}
                  </span>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

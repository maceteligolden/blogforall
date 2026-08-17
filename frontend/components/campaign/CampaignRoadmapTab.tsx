"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CampaignService } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { postTypeLabel, type InteractivePostType } from "@/lib/types/interactive-post";
import { useStartWritingThread } from "@/lib/writing/use-start-writing-thread";

const PAGE_SIZE = 6;

type RoadmapItem = {
  title: string;
  objective: string;
  strategic_intent: string;
  narrative_phase?: string;
  scheduled_at?: string;
  sequence_index: number;
  about?: string;
  keywords?: string[];
  post_type?: InteractivePostType;
  campaign_support?: string;
  draft_status?: string;
  blog_id?: string;
  scheduled_post_id?: string;
};

type RoadmapPayload = {
  current?: {
    status: string;
    version: number;
    summary: string;
    narrative_arc?: string;
    items: RoadmapItem[];
  };
};

export function CampaignRoadmapTab({ campaignId, campaignName }: { campaignId: string; campaignName?: string }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { startWritingThread } = useStartWritingThread();
  const [page, setPage] = useState(0);
  const [regenConfirmOpen, setRegenConfirmOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId),
    queryFn: async () => {
      const res = await CampaignService.getRoadmap(campaignId);
      return res.data.data as RoadmapPayload;
    },
    refetchInterval: (query) => {
      const items = query.state.data?.current?.items ?? [];
      return items.some((item) => item.draft_status === "drafting") ? 4000 : false;
    },
  });

  const planMutation = useMutation({
    mutationFn: () => CampaignService.planCampaign(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(campaignId) });
    },
    onError: (err: unknown) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(campaignId) });
      const message =
        err && typeof err === "object" && "response" in err
          ? String(
              (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
                "Failed to generate roadmap"
            )
          : "Failed to generate roadmap";
      toast({ title: "Error", description: message, variant: "error" });
    },
  });

  const approveMutation = useMutation({
    mutationFn: () => CampaignService.approveRoadmap(campaignId),
    onSuccess: (res) => {
      const payload = res.data?.data as RoadmapPayload | undefined;
      if (payload) {
        queryClient.setQueryData(QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId), payload);
      }
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(campaignId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      toast({
        title: "Roadmap approved",
        description: "Open a card to start a writing conversation, or use the Schedule tab for timing.",
        variant: "success",
      });
    },
    onError: (err: unknown) => {
      const message =
        err && typeof err === "object" && "response" in err
          ? String(
              (err as { response?: { data?: { message?: string } } }).response?.data?.message ??
                "Failed to approve roadmap"
            )
          : "Failed to approve roadmap";
      toast({ title: "Error", description: message, variant: "error" });
    },
  });

  const startWriting = (item: RoadmapItem) => {
    void startWritingThread({
      campaign_id: campaignId,
      campaign_name: campaignName,
      roadmap_sequence_index: item.sequence_index,
      topic: item.title,
      intent: item.strategic_intent,
    });
  };

  const requestPlan = () => {
    if (roadmap) {
      setRegenConfirmOpen(true);
      return;
    }
    planMutation.mutate();
  };

  const confirmRegenerate = () => {
    setRegenConfirmOpen(false);
    planMutation.mutate();
  };

  const roadmap = data?.current;
  const items = roadmap?.items ?? [];
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const pageItems = useMemo(() => items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [items, page]);

  useEffect(() => {
    if (page > totalPages - 1) {
      setPage(Math.max(0, totalPages - 1));
    }
  }, [page, totalPages]);

  useEffect(() => {
    setPage(0);
  }, [roadmap?.version, items.length]);

  if (isLoading) {
    return <p className="text-gray-400 py-8 text-center">Loading roadmap…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          className="bg-primary hover:bg-primary/90 text-white"
          onClick={requestPlan}
          disabled={planMutation.isPending}
        >
          {planMutation.isPending ? "Generating…" : roadmap ? "Regenerate roadmap" : "Generate roadmap"}
        </Button>
        {planMutation.isPending && (
          <p className="text-sm text-gray-500">Researching topics — this can take about a minute.</p>
        )}
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

      <ConfirmModal
        isOpen={regenConfirmOpen}
        onClose={() => setRegenConfirmOpen(false)}
        onConfirm={confirmRegenerate}
        title="Regenerate roadmap?"
        message="This replaces the current plan. Approving the new roadmap will remove existing roadmap posts, including any drafts already started on those items."
        confirmText="Regenerate"
        cancelText="Keep current plan"
        variant="danger"
      />

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
            {roadmap.narrative_arc && <p className="text-gray-400 text-sm mt-3">{roadmap.narrative_arc}</p>}
            <ol className="mt-4 grid gap-2 sm:grid-cols-3">
              {(["awareness", "consideration", "conversion"] as const).map((phase, index) => {
                const count = items.filter((item) => (item.narrative_phase || "awareness") === phase).length;
                const labels = ["Gain attention", "Build consideration", "Drive conversion"];
                return (
                  <li key={phase} className="rounded-md border border-gray-800 bg-black/40 p-3">
                    <p className="text-xs uppercase tracking-wide text-gray-500">
                      {index + 1}. {phase}
                    </p>
                    <p className="text-sm text-white mt-1">{labels[index]}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {count} post{count === 1 ? "" : "s"}
                    </p>
                  </li>
                );
              })}
            </ol>
          </div>
          <ul className="space-y-3">
            {pageItems.map((item) => (
              <li key={item.sequence_index} className="rounded-lg border border-gray-800 bg-gray-950/40 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2 mb-2">
                  <h4 className="text-base font-semibold text-white">{item.title}</h4>
                  <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                    {postTypeLabel(item.post_type ?? "article")}
                  </span>
                </div>
                <p className="text-sm text-gray-300 mb-3">{item.about || item.objective}</p>
                <div className="grid gap-2 text-xs text-gray-400 sm:grid-cols-2">
                  <p>
                    <span className="text-gray-500">Campaign: </span>
                    {campaignName || "This campaign"}
                  </p>
                  <p>
                    <span className="text-gray-500">Supports: </span>
                    {item.campaign_support || item.objective}
                  </p>
                </div>
                {item.keywords && item.keywords.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {item.keywords.map((kw) => (
                      <span key={kw} className="px-2 py-0.5 rounded-full bg-gray-900 text-gray-300 text-xs">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                    {item.scheduled_at && <span>{new Date(item.scheduled_at).toLocaleDateString()}</span>}
                    {item.narrative_phase && <span className="text-primary capitalize">{item.narrative_phase}</span>}
                  </div>
                  {roadmap.status === "approved" && (
                    <DraftAction item={item} starting={false} onStart={() => startWriting(item)} />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {items.length > PAGE_SIZE && (
            <div className="flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                disabled={page === 0}
                onClick={() => setPage((current) => Math.max(0, current - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-400">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function DraftAction({ item, starting, onStart }: { item: RoadmapItem; starting: boolean; onStart: () => void }) {
  const drafting = (item.draft_status === "drafting" && Boolean(item.blog_id)) || starting;
  if (drafting) {
    return (
      <Button size="sm" disabled className="bg-gray-800 text-gray-400">
        Drafting…
      </Button>
    );
  }

  if (item.blog_id) {
    return (
      <Link
        href={`/dashboard/posts/${item.blog_id}`}
        className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
      >
        Review draft
      </Link>
    );
  }

  return (
    <Button size="sm" className="bg-primary hover:bg-primary/90 text-white" onClick={onStart}>
      Start draft
    </Button>
  );
}

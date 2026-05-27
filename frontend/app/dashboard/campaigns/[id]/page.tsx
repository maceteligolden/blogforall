"use client";

import { useState, Suspense } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { useCampaign, useDeleteCampaign, useActivateCampaign, usePauseCampaign, useCancelCampaign } from "@/lib/hooks/use-campaign";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CampaignService } from "@/lib/api/services/campaign.service";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { QUERY_KEYS } from "@/lib/api/config";
import { Calendar, Edit, Trash2, Play, Pause, X, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { ConfirmModal } from "@/components/ui/modal";
import Link from "next/link";
import { CampaignHealthBadge } from "@/components/campaign/CampaignHealthBadge";
import { CampaignRoadmapTab } from "@/components/campaign/CampaignRoadmapTab";
import {
  CampaignProgressReportView,
  type CampaignProgressReportData,
} from "@/components/campaign/CampaignProgressReportView";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "roadmap", label: "Roadmap" },
  { id: "schedule", label: "Schedule" },
  { id: "progress", label: "Progress" },
  { id: "activity", label: "Activity" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function CampaignDetailContent() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const campaignId = params.id as string;
  const tab = (searchParams.get("tab") as TabId) || "overview";
  const queryClient = useQueryClient();

  const { data: campaignResponse, isLoading: campaignLoading } = useCampaign(campaignId);
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: [...QUERY_KEYS.CAMPAIGN(campaignId), "stats"],
    queryFn: () => CampaignService.getCampaignWithStats(campaignId),
    enabled: !!campaignId,
  });

  const { data: scheduledPostsResponse, isLoading: postsLoading } = useQuery({
    queryKey: [...QUERY_KEYS.MY_SCHEDULED_POSTS, campaignId],
    queryFn: async () => {
      const response = await CampaignService.getScheduledPosts({ campaign_id: campaignId });
      return response.data.data;
    },
    enabled: !!campaignId && (tab === "overview" || tab === "schedule"),
  });

  const { data: progressResponse, isLoading: progressLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_PROGRESS_REPORT(campaignId),
    queryFn: async () => {
      const res = await CampaignService.getLatestProgressReport(campaignId);
      return res.data.data as CampaignProgressReportData;
    },
    enabled: !!campaignId && tab === "progress",
  });

  const { data: eventsResponse, isLoading: eventsLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_EVENTS(campaignId),
    queryFn: async () => {
      const res = await CampaignService.listCampaignEvents(campaignId);
      return res.data.data as Array<{ type: string; created_at: string; payload?: Record<string, unknown> }>;
    },
    enabled: !!campaignId && tab === "activity",
  });

  const refreshProgress = useMutation({
    mutationFn: () => CampaignService.generateProgressReport(campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN_PROGRESS_REPORT(campaignId) });
    },
  });

  const deleteCampaign = useDeleteCampaign();
  const activateCampaign = useActivateCampaign();
  const pauseCampaign = usePauseCampaign();
  const cancelCampaign = useCancelCampaign();
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const campaign = campaignResponse?.data?.data;
  const stats = statsResponse?.data?.data;
  const scheduledPosts = scheduledPostsResponse?.data?.data || scheduledPostsResponse || [];

  const setTab = (next: TabId) => {
    const q = new URLSearchParams(searchParams.toString());
    q.set("tab", next);
    router.replace(`/dashboard/campaigns/${campaignId}?${q.toString()}`);
  };

  if (campaignLoading || statsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Campaign not found</h2>
          <Button onClick={() => router.push("/dashboard/campaigns")} className="bg-primary hover:bg-primary/90 text-white">
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    deleteCampaign.mutate(campaignId, { onSuccess: () => router.push("/dashboard/campaigns") });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-900/30 text-green-400 border-green-800";
      case "draft":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
      case "paused":
        return "bg-blue-900/30 text-blue-400 border-blue-800";
      default:
        return "bg-gray-800 text-gray-400 border-gray-700";
    }
  };

  const getPostStatusIcon = (status: string) => {
    switch (status) {
      case "published":
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const healthStatus = (campaign as { health_status?: string }).health_status;

  const scheduleSection = (
    <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-white">Scheduled Posts</h2>
        <Button
          className="bg-primary hover:bg-primary/90 text-white"
          onClick={() => router.push(`/dashboard/campaigns/${campaignId}/schedule`)}
        >
          <Plus className="w-4 h-4 mr-2" />
          Schedule Post
        </Button>
      </div>
      {postsLoading ? (
        <p className="text-gray-400 text-center py-8">Loading posts...</p>
      ) : !Array.isArray(scheduledPosts) || scheduledPosts.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No scheduled posts yet.</p>
      ) : (
        <div className="space-y-3">
          {scheduledPosts.map((post: { _id: string; title: string; status: string; scheduled_at: string; blog_id?: string }) => (
            <div key={post._id} className="bg-black rounded-lg border border-gray-800 p-4">
              <div className="flex items-center gap-2 mb-1">
                {getPostStatusIcon(post.status)}
                <h3 className="text-base font-semibold text-white">{post.title}</h3>
                <span className="text-xs text-gray-500 capitalize">{post.status}</span>
              </div>
              <p className="text-sm text-gray-400">{new Date(post.scheduled_at).toLocaleString()}</p>
              {post.blog_id && (
                <Link href={`/dashboard/blogs/${post.blog_id}/view`} className="text-primary text-sm mt-2 inline-block">
                  View blog →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: campaign.name },
          ]}
        />

        <div className="flex justify-between items-start mb-4 mt-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h1 className="text-3xl font-display text-white">{campaign.name}</h1>
              <span className={`px-3 py-1 text-xs rounded capitalize border ${getStatusColor(campaign.status)}`}>
                {campaign.status}
              </span>
              {healthStatus && <CampaignHealthBadge status={healthStatus} />}
            </div>
            {campaign.description && <p className="text-gray-400">{campaign.description}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {campaign.status === "draft" && (
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => activateCampaign.mutate(campaignId)}>
                <Play className="w-4 h-4 mr-2" />
                Activate
              </Button>
            )}
            {campaign.status === "active" && (
              <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => pauseCampaign.mutate(campaignId)}>
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            <Button variant="outline" className="border-gray-700 text-gray-300" onClick={() => router.push(`/dashboard/campaigns/${campaignId}/edit`)}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            {campaign.status === "draft" && (
              <Button variant="outline" className="border-red-600 text-red-400" onClick={() => setShowDeleteModal(true)}>
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <nav className="flex gap-1 border-b border-gray-800 mb-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
                tab === t.id
                  ? "border-primary text-white"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        {tab === "overview" && (
          <>
            {stats && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <p className="text-sm text-gray-400">Published</p>
                  <p className="text-2xl font-bold">{stats.posts_published || 0}</p>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <p className="text-sm text-gray-400">Scheduled</p>
                  <p className="text-2xl font-bold">{stats.posts_scheduled || 0}</p>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-2xl font-bold">{stats.posts_pending || 0}</p>
                </div>
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
                  <p className="text-sm text-gray-400">Planned</p>
                  <p className="text-2xl font-bold">{campaign.total_posts_planned ?? "—"}</p>
                </div>
              </div>
            )}
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
                  <h2 className="text-xl font-semibold mb-4">Campaign details</h2>
                  <p className="text-white mb-4">{campaign.goal}</p>
                  <p className="text-sm text-gray-400">
                    {new Date(campaign.start_date).toLocaleDateString()} –{" "}
                    {new Date(campaign.end_date).toLocaleDateString()} · {campaign.posting_frequency}
                  </p>
                  <p className="text-xs text-gray-500 mt-4">
                    All campaign posts publish only after you approve them in the scheduled-post review flow.
                  </p>
                </div>
                {scheduleSection}
              </div>
              <div>
                <Link
                  href="/dashboard/campaigns/reports"
                  className="block bg-gray-900 rounded-lg border border-gray-800 p-4 text-sm text-primary hover:border-gray-600"
                >
                  View workspace daily reports →
                </Link>
              </div>
            </div>
          </>
        )}

        {tab === "roadmap" && <CampaignRoadmapTab campaignId={campaignId} />}
        {tab === "schedule" && scheduleSection}
        {tab === "progress" && (
          progressLoading ? (
            <p className="text-gray-400 py-12 text-center">Loading progress report…</p>
          ) : progressResponse ? (
            <CampaignProgressReportView
              report={progressResponse}
              onRefresh={() => refreshProgress.mutate()}
              refreshing={refreshProgress.isPending}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-400 mb-4">No progress report yet.</p>
              <Button onClick={() => refreshProgress.mutate()} disabled={refreshProgress.isPending}>
                Generate report
              </Button>
            </div>
          )
        )}
        {tab === "activity" && (
          eventsLoading ? (
            <p className="text-gray-400 py-8 text-center">Loading activity…</p>
          ) : (
            <div className="space-y-2">
              {(eventsResponse ?? []).map((ev, i) => (
                <div key={i} className="bg-gray-900 border border-gray-800 rounded-lg p-4 text-sm">
                  <span className="text-white capitalize">{ev.type.replace(/_/g, " ")}</span>
                  <span className="text-gray-500 ml-3">{new Date(ev.created_at).toLocaleString()}</span>
                </div>
              ))}
              {(eventsResponse ?? []).length === 0 && (
                <p className="text-gray-500 text-center py-8">No events recorded yet.</p>
              )}
            </div>
          )
        )}

        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleDelete}
          title="Delete Campaign"
          message="Are you sure you want to delete this campaign? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading…</div>}>
      <CampaignDetailContent />
    </Suspense>
  );
}

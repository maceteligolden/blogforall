"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCampaign, useDeleteCampaign, useActivateCampaign, usePauseCampaign, useCancelCampaign } from "@/lib/hooks/use-campaign";
import { useQuery } from "@tanstack/react-query";
import { CampaignService } from "@/lib/api/services/campaign.service";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { QUERY_KEYS } from "@/lib/api/config";
import { Calendar, Edit, Trash2, Play, Pause, X, Plus, Clock, CheckCircle, XCircle } from "lucide-react";
import { ConfirmModal } from "@/components/ui/modal";
import Link from "next/link";

export default function CampaignDetailPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;

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
    enabled: !!campaignId,
  });

  const deleteCampaign = useDeleteCampaign();
  const activateCampaign = useActivateCampaign();
  const pauseCampaign = usePauseCampaign();
  const cancelCampaign = useCancelCampaign();

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const campaign = campaignResponse?.data?.data;
  const stats = statsResponse?.data?.data;
  const scheduledPosts = scheduledPostsResponse?.data?.data || [];

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
          <p className="text-gray-400 mb-6">The campaign you&apos;re looking for doesn&apos;t exist.</p>
          <Button onClick={() => router.push("/dashboard/campaigns")} className="bg-primary hover:bg-primary/90 text-white">
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const handleDelete = () => {
    deleteCampaign.mutate(campaignId, {
      onSuccess: () => {
        router.push("/dashboard/campaigns");
      },
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-900/30 text-green-400 border-green-800";
      case "draft":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
      case "paused":
        return "bg-blue-900/30 text-blue-400 border-blue-800";
      case "completed":
        return "bg-gray-800 text-gray-400 border-gray-700";
      case "cancelled":
        return "bg-red-900/30 text-red-400 border-red-800";
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
      case "pending":
      case "scheduled":
        return <Clock className="w-4 h-4 text-yellow-400" />;
      case "cancelled":
        return <XCircle className="w-4 h-4 text-gray-400" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: campaign.name },
          ]}
        />

        {/* Header */}
        <div className="flex justify-between items-start mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-display text-white">{campaign.name}</h1>
              <span
                className={`px-3 py-1 text-xs rounded capitalize border ${getStatusColor(campaign.status)}`}
              >
                {campaign.status}
              </span>
            </div>
            {campaign.description && (
              <p className="text-gray-400 mt-2">{campaign.description}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {campaign.status === "draft" && (
              <Button
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => activateCampaign.mutate(campaignId)}
                disabled={activateCampaign.isPending}
              >
                <Play className="w-4 h-4 mr-2" />
                Activate
              </Button>
            )}
            {campaign.status === "active" && (
              <Button
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={() => pauseCampaign.mutate(campaignId)}
                disabled={pauseCampaign.isPending}
              >
                <Pause className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}
            {(campaign.status === "active" || campaign.status === "paused") && (
              <Button
                variant="outline"
                className="border-red-600 text-red-400 hover:bg-red-900/20"
                onClick={() => {
                  if (confirm("Are you sure you want to cancel this campaign? This will cancel all scheduled posts.")) {
                    cancelCampaign.mutate(campaignId);
                  }
                }}
                disabled={cancelCampaign.isPending}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            )}
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={() => router.push(`/dashboard/campaigns/${campaignId}/edit`)}
            >
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            {campaign.status === "draft" && (
              <Button
                variant="outline"
                className="border-red-600 text-red-400 hover:bg-red-900/20"
                onClick={() => setShowDeleteModal(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Posts Published</h3>
              <p className="text-2xl font-bold text-white">{stats.posts_published || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Posts Scheduled</h3>
              <p className="text-2xl font-bold text-white">{stats.posts_scheduled || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Posts Pending</h3>
              <p className="text-2xl font-bold text-white">{stats.posts_pending || 0}</p>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Total Planned</h3>
              <p className="text-2xl font-bold text-white">{campaign.total_posts_planned || "N/A"}</p>
            </div>
          </div>
        )}

        {/* Campaign Details */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Campaign Info */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Campaign Details</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-1">Goal</h3>
                  <p className="text-white">{campaign.goal}</p>
                </div>
                {campaign.target_audience && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Target Audience</h3>
                    <p className="text-white">{campaign.target_audience}</p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Start Date</h3>
                    <p className="text-white">{new Date(campaign.start_date).toLocaleString()}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">End Date</h3>
                    <p className="text-white">{new Date(campaign.end_date).toLocaleString()}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Posting Frequency</h3>
                    <p className="text-white capitalize">{campaign.posting_frequency}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Timezone</h3>
                    <p className="text-white">{campaign.timezone}</p>
                  </div>
                </div>
                {campaign.budget && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-400 mb-1">Budget</h3>
                    <p className="text-white">${campaign.budget.toLocaleString()}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Scheduled Posts */}
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
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary mb-2"></div>
                  <p className="text-gray-400">Loading posts...</p>
                </div>
              ) : scheduledPosts.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 mb-4">No scheduled posts yet</p>
                  <Button
                    className="bg-primary hover:bg-primary/90 text-white"
                    onClick={() => router.push(`/dashboard/campaigns/${campaignId}/schedule`)}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Schedule First Post
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {scheduledPosts.map((post: any) => (
                    <div
                      key={post._id}
                      className="bg-black rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {getPostStatusIcon(post.status)}
                            <h3 className="text-base font-semibold text-white">{post.title}</h3>
                            <span
                              className={`px-2 py-1 text-xs rounded capitalize ${
                                post.status === "published"
                                  ? "bg-green-900/30 text-green-400 border border-green-800"
                                  : post.status === "pending" || post.status === "scheduled"
                                    ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800"
                                    : post.status === "failed"
                                      ? "bg-red-900/30 text-red-400 border border-red-800"
                                      : "bg-gray-800 text-gray-400 border border-gray-700"
                              }`}
                            >
                              {post.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-400">
                            <span>Scheduled: {new Date(post.scheduled_at).toLocaleString()}</span>
                            {post.published_at && (
                              <span>Published: {new Date(post.published_at).toLocaleString()}</span>
                            )}
                          </div>
                          {post.error_message && (
                            <p className="text-sm text-red-400 mt-2">Error: {post.error_message}</p>
                          )}
                        </div>
                        {post.blog_id && (
                          <Link
                            href={`/dashboard/blogs/${post.blog_id}/view`}
                            className="text-primary hover:text-primary/80 text-sm"
                          >
                            View Blog →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Success Metrics */}
            {campaign.success_metrics && (
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
                <h2 className="text-xl font-semibold text-white mb-4">Success Metrics</h2>
                <div className="space-y-3">
                  {campaign.success_metrics.target_views && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Target Views</h3>
                      <p className="text-white">{campaign.success_metrics.target_views.toLocaleString()}</p>
                    </div>
                  )}
                  {campaign.success_metrics.target_engagement && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Target Engagement</h3>
                      <p className="text-white">{campaign.success_metrics.target_engagement.toLocaleString()}</p>
                    </div>
                  )}
                  {campaign.success_metrics.target_conversions && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-400 mb-1">Target Conversions</h3>
                      <p className="text-white">{campaign.success_metrics.target_conversions.toLocaleString()}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Campaign Info */}
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h2 className="text-xl font-semibold text-white mb-4">Campaign Info</h2>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-gray-400">Created:</span>
                  <span className="text-white ml-2">
                    {new Date(campaign.created_at || "").toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-gray-400">Last Updated:</span>
                  <span className="text-white ml-2">
                    {new Date(campaign.updated_at || "").toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
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

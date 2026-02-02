"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { CampaignService, ScheduledPost } from "@/lib/api/services/campaign.service";
import { useAllScheduledPosts, useCancelScheduledPost, useDeleteScheduledPost } from "@/lib/hooks/use-scheduled-post";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { useToast } from "@/components/ui/toast";
import { Calendar, Plus, Clock, CheckCircle, XCircle, X, Edit, Trash2, Filter } from "lucide-react";
import { ConfirmModal } from "@/components/ui/modal";
import Link from "next/link";

export default function ScheduledPostsPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<string | null>(null);

  const { data: scheduledPosts = [], isLoading } = useAllScheduledPosts(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );

  const cancelPostMutation = useCancelScheduledPost();
  const deletePostMutation = useDeleteScheduledPost();

  const filteredPosts = useMemo(() => {
    let filtered: ScheduledPost[] = scheduledPosts;

    // Filter by search query (status filter is already applied via query params)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (post: ScheduledPost) =>
          post.title.toLowerCase().includes(query) ||
          (post.campaign_id && query.includes("campaign"))
      );
    }

    return filtered.sort((a: ScheduledPost, b: ScheduledPost) => {
      return new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime();
    });
  }, [scheduledPosts, searchQuery]);

  const getStatusIcon = (status: string) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-900/30 text-green-400 border-green-800";
      case "pending":
      case "scheduled":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
      case "failed":
        return "bg-red-900/30 text-red-400 border-red-800";
      case "cancelled":
        return "bg-gray-800 text-gray-400 border-gray-700";
      default:
        return "bg-gray-800 text-gray-400 border-gray-700";
    }
  };

  const handleDelete = () => {
    if (postToDelete) {
      deletePostMutation.mutate(postToDelete, {
        onSuccess: () => {
          toast({
            title: "Success",
            description: "Scheduled post deleted successfully",
            variant: "success",
          });
          setShowDeleteModal(false);
          setPostToDelete(null);
        },
        onError: (err: any) => {
          toast({
            title: "Error",
            description: err?.response?.data?.message || "Failed to delete scheduled post",
            variant: "error",
          });
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading scheduled posts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Scheduled Posts" }]} />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display text-white">Scheduled Posts</h1>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => router.push("/dashboard/campaigns")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Schedule Post
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Input
                type="text"
                placeholder="Search posts by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-black border-gray-700 text-white"
              />
            </div>
            <div className="flex items-center space-x-2 border border-gray-800 rounded-lg p-1 bg-gray-900">
              {["all", "pending", "scheduled", "published", "failed", "cancelled"].map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                    statusFilter === status
                      ? "bg-primary text-white"
                      : "text-gray-400 hover:text-white"
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scheduled Posts List */}
        {filteredPosts.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No scheduled posts</h3>
            <p className="text-gray-400 mb-6">
              {scheduledPosts.length === 0
                ? "You haven't scheduled any posts yet. Create a campaign or schedule a standalone post."
                : "No posts match your filters."}
            </p>
            {scheduledPosts.length === 0 && (
              <div className="flex gap-3 justify-center">
                <Button
                  className="bg-primary hover:bg-primary/90 text-white"
                  onClick={() => router.push("/dashboard/campaigns")}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Campaign
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                  onClick={() => router.push("/dashboard/scheduled-posts/new")}
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Post
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post._id}
                className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      {getStatusIcon(post.status)}
                      <h3 className="text-lg font-semibold text-white">{post.title}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded capitalize border ${getStatusColor(post.status)}`}
                      >
                        {post.status}
                      </span>
                      {post.campaign_id && (
                        <Link
                          href={`/dashboard/campaigns/${post.campaign_id}`}
                          className="text-xs text-primary hover:text-primary/80"
                        >
                          View Campaign →
                        </Link>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Scheduled For</p>
                        <p className="text-sm text-white">
                          {new Date(post.scheduled_at).toLocaleString()}
                        </p>
                      </div>
                      {post.published_at && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">Published At</p>
                          <p className="text-sm text-white">
                            {new Date(post.published_at).toLocaleString()}
                          </p>
                        </div>
                      )}
                      <div>
                        <p className="text-xs text-gray-400 mb-1">Timezone</p>
                        <p className="text-sm text-white">{post.timezone}</p>
                      </div>
                    </div>

                    {post.auto_generate && (
                      <div className="mb-3">
                        <p className="text-xs text-gray-400 mb-1">Generation Prompt</p>
                        <p className="text-sm text-gray-300 line-clamp-2">
                          {post.generation_prompt || "N/A"}
                        </p>
                      </div>
                    )}

                    {post.error_message && (
                      <div className="mb-3 p-3 bg-red-900/20 border border-red-800 rounded-md">
                        <p className="text-xs text-red-400 font-medium mb-1">Error</p>
                        <p className="text-sm text-red-300">{post.error_message}</p>
                        {post.publish_attempts > 0 && (
                          <p className="text-xs text-red-400 mt-1">
                            Attempts: {post.publish_attempts}
                          </p>
                        )}
                      </div>
                    )}

                    {post.blog_id && (
                      <Link
                        href={`/dashboard/blogs/${post.blog_id}/view`}
                        className="text-sm text-primary hover:text-primary/80 inline-flex items-center gap-1"
                      >
                        View Blog Post →
                      </Link>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    {(post.status === "pending" || post.status === "scheduled") && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-gray-700 text-gray-300 hover:bg-gray-800"
                          onClick={() => {
                            // TODO: Navigate to edit page
                            toast({
                              title: "Info",
                              description: "Edit functionality coming soon",
                              variant: "info",
                            });
                          }}
                        >
                          <Edit className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-400 hover:bg-red-900/20"
                          onClick={() => {
                            if (confirm("Are you sure you want to cancel this scheduled post?")) {
                              cancelPostMutation.mutate(post._id, {
                                onSuccess: () => {
                                  toast({
                                    title: "Success",
                                    description: "Scheduled post cancelled successfully",
                                    variant: "success",
                                  });
                                },
                                onError: (err: any) => {
                                  toast({
                                    title: "Error",
                                    description: err?.response?.data?.message || "Failed to cancel scheduled post",
                                    variant: "error",
                                  });
                                },
                              });
                            }
                          }}
                          disabled={cancelPostMutation.isPending}
                        >
                          <X className="w-3 h-3 mr-1" />
                          Cancel
                        </Button>
                      </>
                    )}
                    {(post.status === "pending" || post.status === "scheduled" || post.status === "failed" || post.status === "cancelled") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-red-600 text-red-400 hover:bg-red-900/20"
                        onClick={() => {
                          setPostToDelete(post._id);
                          setShowDeleteModal(true);
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <ConfirmModal
          isOpen={showDeleteModal}
          onClose={() => {
            setShowDeleteModal(false);
            setPostToDelete(null);
          }}
          onConfirm={handleDelete}
          title="Delete Scheduled Post"
          message="Are you sure you want to delete this scheduled post? This action cannot be undone."
          confirmText="Delete"
          variant="danger"
        />
      </div>
    </div>
  );
}

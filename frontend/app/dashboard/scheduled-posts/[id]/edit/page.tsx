"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CampaignService, CreateScheduledPostRequest } from "@/lib/api/services/campaign.service";
import { BlogService } from "@/lib/api/services/blog.service";
import { useBlogs } from "@/lib/hooks/use-blog";
import { useScheduledPost, useUpdateScheduledPost } from "@/lib/hooks/use-scheduled-post";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Calendar } from "lucide-react";

export default function EditScheduledPostPage() {
  const router = useRouter();
  const params = useParams();
  const scheduledPostId = params.id as string;
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: scheduledPostResponse, isLoading } = useScheduledPost(scheduledPostId);
  const scheduledPost = scheduledPostResponse?.data?.data;
  const { data: blogs } = useBlogs();
  const updateScheduledPost = useUpdateScheduledPost();

  const [formData, setFormData] = useState<{
    blog_id?: string;
    title: string;
    scheduled_at: string;
    timezone: string;
  }>({
    blog_id: "",
    title: "",
    scheduled_at: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
  });

  const [error, setError] = useState("");

  useEffect(() => {
    if (scheduledPost) {
      const scheduledDate = new Date(scheduledPost.scheduled_at).toISOString().slice(0, 16);
      setFormData({
        blog_id: scheduledPost.blog_id || "",
        title: scheduledPost.title,
        scheduled_at: scheduledDate,
        timezone: scheduledPost.timezone,
      });
    }
  }, [scheduledPost]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title.trim()) {
      setError("Post title is required");
      return;
    }

    if (!formData.scheduled_at) {
      setError("Scheduled date is required");
      return;
    }

    const scheduledDate = new Date(formData.scheduled_at);
    const now = new Date();

    if (scheduledDate < now) {
      setError("Scheduled date cannot be in the past");
      return;
    }

    // Validate scheduled date is within campaign dates if campaign exists
    if (scheduledPost?.campaign_id) {
      // We'd need to fetch campaign to validate, but for now just check if date is reasonable
      // In a real scenario, you'd fetch the campaign and validate
    }

    const updateData: Partial<CreateScheduledPostRequest> = {
      title: formData.title.trim(),
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      blog_id: formData.blog_id || undefined,
      timezone: formData.timezone,
    };

    updateScheduledPost.mutate(
      { id: scheduledPostId, data: updateData },
      {
        onSuccess: async () => {
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
          await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POST(scheduledPostId) });
          toast({
            title: "Success",
            description: "Scheduled post updated successfully",
            variant: "success",
          });
          router.push("/dashboard/scheduled-posts");
        },
        onError: (err: any) => {
          const message = err?.response?.data?.message || "Failed to update scheduled post";
          setError(message);
          toast({
            title: "Error",
            description: message,
            variant: "error",
          });
        },
      }
    );
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const handleBlogSelect = (blogId: string) => {
    const selectedBlog = blogs?.find((b: any) => b._id === blogId);
    setFormData({
      ...formData,
      blog_id: blogId,
      title: selectedBlog?.title || formData.title,
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading scheduled post...</p>
        </div>
      </div>
    );
  }

  if (!scheduledPost) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Scheduled post not found</h2>
          <Button onClick={() => router.push("/dashboard/scheduled-posts")} className="bg-primary hover:bg-primary/90 text-white">
            Back to Scheduled Posts
          </Button>
        </div>
      </div>
    );
  }

  // Prevent editing published or cancelled posts
  if (scheduledPost.status === "published" || scheduledPost.status === "cancelled") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-semibold text-white mb-2">Cannot Edit Post</h2>
          <p className="text-gray-400 mb-4">
            {scheduledPost.status === "published"
              ? "This post has already been published and cannot be edited."
              : "This post has been cancelled and cannot be edited."}
          </p>
          <Button onClick={() => router.push("/dashboard/scheduled-posts")} className="bg-primary hover:bg-primary/90 text-white">
            Back to Scheduled Posts
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 16);

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Scheduled Posts", href: "/dashboard/scheduled-posts" },
            { label: "Edit Scheduled Post" },
          ]}
        />

        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-display text-white">Edit Scheduled Post</h1>
          <p className="text-gray-400 mt-2">Update scheduled post details</p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Post Status Info */}
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-400 mb-1">Current Status</p>
                  <span
                    className={`px-2 py-1 text-xs rounded capitalize border ${
                      scheduledPost.status === "published"
                        ? "bg-green-900/30 text-green-400 border-green-800"
                        : scheduledPost.status === "pending" || scheduledPost.status === "scheduled"
                        ? "bg-yellow-900/30 text-yellow-400 border-yellow-800"
                        : scheduledPost.status === "failed"
                        ? "bg-red-900/30 text-red-400 border-red-800"
                        : "bg-gray-800 text-gray-400 border-gray-700"
                    }`}
                  >
                    {scheduledPost.status}
                  </span>
                </div>
                {scheduledPost.campaign_id && (
                  <div>
                    <p className="text-sm text-gray-400 mb-1">Campaign</p>
                    <a
                      href={`/dashboard/campaigns/${scheduledPost.campaign_id}`}
                      className="text-sm text-primary hover:text-primary/80"
                    >
                      View Campaign →
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Post Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Post Details
              </h3>

              {scheduledPost.auto_generate ? (
                <div className="bg-blue-900/20 border border-blue-800 rounded-md p-3">
                  <p className="text-sm text-blue-300">
                    This post is set to auto-generate content. The generation prompt cannot be changed here.
                  </p>
                </div>
              ) : (
                <div>
                  <Label htmlFor="blog_id" className="text-gray-300">
                    Blog Post
                  </Label>
                  <select
                    id="blog_id"
                    name="blog_id"
                    value={formData.blog_id}
                    onChange={(e) => handleBlogSelect(e.target.value)}
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                  >
                    <option value="">Select a blog post...</option>
                    {blogs
                      ?.filter((blog: any) => blog.status === "draft" || blog.status === "published")
                      .map((blog: any) => (
                        <option key={blog._id} value={blog._id}>
                          {blog.title} ({blog.status})
                        </option>
                      ))}
                  </select>
                  <p className="mt-1 text-xs text-gray-400">
                    Only draft and published blogs can be scheduled
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="title" className="text-gray-300">
                  Post Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  name="title"
                  type="text"
                  value={formData.title}
                  onChange={handleChange}
                  placeholder="Enter post title..."
                  className="mt-1 bg-black border-gray-700 text-white"
                  required
                  maxLength={200}
                />
              </div>
            </div>

            {/* Schedule Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Schedule Details
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="scheduled_at" className="text-gray-300">
                    Scheduled Date & Time <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="scheduled_at"
                    name="scheduled_at"
                    type="datetime-local"
                    value={formData.scheduled_at}
                    onChange={handleChange}
                    min={today}
                    className="mt-1 bg-black border-gray-700 text-white"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="timezone" className="text-gray-300">
                    Timezone
                  </Label>
                  <Input
                    id="timezone"
                    name="timezone"
                    type="text"
                    value={formData.timezone}
                    onChange={handleChange}
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white"
                disabled={updateScheduledPost.isPending}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {updateScheduledPost.isPending ? "Updating..." : "Update Scheduled Post"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

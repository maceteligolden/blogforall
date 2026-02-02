"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CampaignService, CreateScheduledPostRequest } from "@/lib/api/services/campaign.service";
import { BlogService } from "@/lib/api/services/blog.service";
import { useBlogs } from "@/lib/hooks/use-blog";
import { useCreateScheduledPost } from "@/lib/hooks/use-scheduled-post";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";
import { ArrowLeft, Calendar } from "lucide-react";

export default function NewScheduledPostPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: blogs } = useBlogs();
  const { data: campaignsResponse } = useQuery({
    queryKey: QUERY_KEYS.MY_CAMPAIGNS,
    queryFn: async () => {
      const response = await CampaignService.getCampaigns();
      return response.data?.data || [];
    },
  });

  const createScheduledPost = useCreateScheduledPost();

  const [formData, setFormData] = useState<{
    blog_id: string;
    campaign_id?: string;
    title: string;
    scheduled_at: string;
    timezone: string;
    auto_generate: boolean;
    generation_prompt: string;
    metadata: {};
  }>({
    blog_id: "",
    campaign_id: "",
    title: "",
    scheduled_at: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    auto_generate: false,
    generation_prompt: "",
    metadata: {},
  });

  const [error, setError] = useState("");
  const [useExistingBlog, setUseExistingBlog] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string>("");

  useEffect(() => {
    if (selectedCampaign && campaignsResponse) {
      const campaign = campaignsResponse.find((c: any) => c._id === selectedCampaign);
      if (campaign) {
        setFormData((prev) => ({
          ...prev,
          campaign_id: selectedCampaign,
          timezone: campaign.timezone || prev.timezone,
          metadata: {
            campaign_goal: campaign.goal,
            target_audience: campaign.target_audience,
          },
        }));
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        campaign_id: undefined,
      }));
    }
  }, [selectedCampaign, campaignsResponse]);

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

    if (useExistingBlog && !formData.blog_id) {
      setError("Please select a blog post");
      return;
    }

    if (!useExistingBlog && !formData.auto_generate) {
      setError("Please enable auto-generation or select an existing blog");
      return;
    }

    if (!useExistingBlog && formData.auto_generate && !formData.generation_prompt?.trim()) {
      setError("Generation prompt is required for auto-generated posts");
      return;
    }

    // Validate scheduled date is within campaign dates if campaign is selected
    if (selectedCampaign && campaignsResponse) {
      const campaign = campaignsResponse.find((c: any) => c._id === selectedCampaign);
      if (campaign) {
        const campaignStart = new Date(campaign.start_date);
        const campaignEnd = new Date(campaign.end_date);
        if (scheduledDate < campaignStart || scheduledDate > campaignEnd) {
          setError(
            `Scheduled date must be between ${campaignStart.toLocaleDateString()} and ${campaignEnd.toLocaleDateString()}`
          );
          return;
        }
      }
    }

    const postData: CreateScheduledPostRequest = {
      ...formData,
      title: formData.title.trim(),
      scheduled_at: new Date(formData.scheduled_at).toISOString(),
      blog_id: useExistingBlog ? formData.blog_id : undefined,
      auto_generate: !useExistingBlog,
      generation_prompt: !useExistingBlog ? formData.generation_prompt : undefined,
      campaign_id: selectedCampaign || undefined,
    };

    createScheduledPost.mutate(postData, {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
        toast({
          title: "Success",
          description: "Post scheduled successfully",
          variant: "success",
        });
        router.push("/dashboard/scheduled-posts");
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || "Failed to schedule post";
        setError(message);
        toast({
          title: "Error",
          description: message,
          variant: "error",
        });
      },
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

  // Get minimum date (today)
  const today = new Date().toISOString().slice(0, 16);
  let minDate = today;
  let maxDate: string | undefined;

  if (selectedCampaign && campaignsResponse) {
    const campaign = campaignsResponse.find((c: any) => c._id === selectedCampaign);
    if (campaign) {
      minDate = new Date(campaign.start_date).toISOString().slice(0, 16);
      maxDate = new Date(campaign.end_date).toISOString().slice(0, 16);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Scheduled Posts", href: "/dashboard/scheduled-posts" },
            { label: "Schedule Post" },
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
          <h1 className="text-3xl font-display text-white">Schedule Post</h1>
          <p className="text-gray-400 mt-2">Schedule a blog post (with or without a campaign)</p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Campaign Selection (Optional) */}
            <div>
              <Label htmlFor="campaign_id" className="text-gray-300">
                Campaign (Optional)
              </Label>
              <select
                id="campaign_id"
                value={selectedCampaign}
                onChange={(e) => setSelectedCampaign(e.target.value)}
                className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
              >
                <option value="">None (Standalone Post)</option>
                {campaignsResponse?.map((campaign: any) => (
                  <option key={campaign._id} value={campaign._id}>
                    {campaign.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-400">
                You can schedule a post without a campaign, or assign it to an existing campaign
              </p>
            </div>

            {/* Post Type Selection */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Post Type
              </h3>

              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={useExistingBlog}
                    onChange={() => setUseExistingBlog(true)}
                    className="w-4 h-4 text-primary bg-gray-800 border-gray-700"
                  />
                  <span className="text-gray-300">Use Existing Blog</span>
                </label>
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={!useExistingBlog}
                    onChange={() => setUseExistingBlog(false)}
                    className="w-4 h-4 text-primary bg-gray-800 border-gray-700"
                  />
                  <span className="text-gray-300">Auto-Generate Blog</span>
                </label>
              </div>
            </div>

            {/* Blog Selection or Generation Prompt */}
            {useExistingBlog ? (
              <div>
                <Label htmlFor="blog_id" className="text-gray-300">
                  Select Blog <span className="text-red-400">*</span>
                </Label>
                <select
                  id="blog_id"
                  name="blog_id"
                  value={formData.blog_id}
                  onChange={(e) => handleBlogSelect(e.target.value)}
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                  required
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
            ) : (
              <div>
                <Label htmlFor="generation_prompt" className="text-gray-300">
                  Generation Prompt <span className="text-red-400">*</span>
                </Label>
                <textarea
                  id="generation_prompt"
                  name="generation_prompt"
                  value={formData.generation_prompt}
                  onChange={handleChange}
                  placeholder="Describe what you want the blog post to be about..."
                  className="mt-1 flex min-h-[120px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  required={!useExistingBlog}
                />
                <p className="mt-1 text-xs text-gray-400">
                  The AI will generate a blog post based on this prompt when it&apos;s time to publish
                </p>
              </div>
            )}

            {/* Post Details */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Schedule Details
              </h3>

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
                <p className="mt-1 text-xs text-gray-400">
                  {useExistingBlog
                    ? "This will be used as a preview title"
                    : "This will be the title of the generated blog post"}
                </p>
              </div>

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
                    min={minDate}
                    max={maxDate}
                    className="mt-1 bg-black border-gray-700 text-white"
                    required
                  />
                  {selectedCampaign && campaignsResponse && (
                    <p className="mt-1 text-xs text-gray-400">
                      Must be within the campaign date range
                    </p>
                  )}
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
                disabled={createScheduledPost.isPending}
              >
                <Calendar className="w-4 h-4 mr-2" />
                {createScheduledPost.isPending ? "Scheduling..." : "Schedule Post"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

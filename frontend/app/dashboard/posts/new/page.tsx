"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { useCreateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { BlogService } from "@/lib/api/services/blog.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useCategories } from "@/lib/hooks/use-category";
import { useBlogReview } from "@/lib/hooks/use-blog-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { blocksToHtml, getContentBlocksValidationErrors } from "@/lib/utils/content-blocks";
import { deriveExcerptFromContent } from "@/lib/utils/blog-excerpt";
import { hasBodyContent, hasTitle } from "@/lib/utils/blog-form-validation";
import { contentToBlocks } from "@/lib/utils/content-to-blocks";
import type { ContentBlock } from "@/lib/types/blog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BlogReviewCard } from "@/components/blog/blog-review-card";
import { BlogReviewComparison } from "@/components/blog/blog-review-comparison";
import { AiPostWizard } from "@/components/blog/ai-post-wizard";
import { useBlogDraft } from "@/lib/hooks/use-blog-draft";
import { Sparkles, PenTool, Save, Trash2, Keyboard, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { generationTracker } from "@/lib/analytics/flows/generation.tracker";
import { PublishDestinationPicker } from "@/components/integrations/publish-destination-picker";
import { usePublishDestinations } from "@/lib/hooks/use-publish-destinations";

type BlogCreationMode = "write" | "ai-generate";

export default function NewBlogPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasDraft, draftRestored, setDraftRestored, loadDraft, saveDraft, clearDraft } = useBlogDraft();
  const createBlog = useCreateBlog();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const { reviewBlogAsync, isReviewing, reviewResult } = useBlogReview();
  const [mode, setMode] = useState<BlogCreationMode>("write");
  const [autoReviewResult, setAutoReviewResult] = useState<any>(null);
  const [showReview, setShowReview] = useState(false);
  const [reviewPanelTab, setReviewPanelTab] = useState<"content" | "review">("content");
  const [reviewHasNewInfo, setReviewHasNewInfo] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [error, setError] = useState("");
  const { destinations, selected: publishDestinations, setSelected: setPublishDestinations } = usePublishDestinations();
  const [formData, setFormData] = useState<{
    title: string;
    content: string;
    content_type: "html" | "markdown";
    content_blocks?: ContentBlock[];
    featured_image: string;
    category: string;
    campaign_id: string;
    status: "draft" | "scheduled" | "published" | "unpublished";
    scheduled_at: string;
  }>({
    title: "",
    content: "",
    content_type: "html",
    featured_image: "",
    category: "",
    campaign_id: "",
    status: "draft",
    scheduled_at: "",
  });

  const canSubmitWriteForm = mode === "write" && hasTitle(formData.title) && hasBodyContent(formData);
  const canReviewForm = hasTitle(formData.title) && hasBodyContent(formData);
  const activeReviewResult = reviewResult || autoReviewResult;

  useEffect(() => {
    generationTracker.viewed();
  }, []);

  const getContentHtml = () =>
    formData.content_blocks != null && formData.content_blocks.length > 0
      ? blocksToHtml(formData.content_blocks)
      : formData.content;

  const derivedExcerpt = () => deriveExcerptFromContent(getContentHtml());

  const handleWizardQueued = (_result: { blog_id: string }) => {
    generationTracker.confirmed({ generation_type: "ai-generate" });
    toast({
      title: "Writing in the background",
      description: "Your post will be ready to edit soon. We'll notify you when it's done.",
      variant: "success",
    });
  };

  const handleReview = async () => {
    const useBlocks = formData.content_blocks != null && formData.content_blocks.length > 0;
    const contentForReview = useBlocks ? blocksToHtml(formData.content_blocks || []) : formData.content;
    if (!formData.title || !contentForReview?.trim()) {
      setError("Title and content are required for review");
      return;
    }

    setError("");
    try {
      const res = await reviewBlogAsync({
        data: {
          title: formData.title,
          content: contentForReview,
          excerpt: derivedExcerpt() || undefined,
          category: formData.category || undefined,
          content_blocks: useBlocks ? formData.content_blocks : undefined,
        },
      });
      const payload = res?.data?.data;
      setAutoReviewResult(payload || null);
      setShowReview(true);
      setReviewHasNewInfo(false);
      setReviewPanelTab("review");
      if (mode === "ai-generate" && (formData.title || hasBodyContent(formData))) {
        setMode("write");
      }
    } catch {
      // Error handled by hook
    }
  };

  useEffect(() => {
    const draft = loadDraft();
    if (draft && !draftRestored) {
      const shouldRestore = window.confirm("You have a saved draft. Would you like to restore it?");
      if (shouldRestore) {
        const d = draft.formData;
        setMode("write");
        setFormData({
          title: d.title,
          content: d.content,
          content_type: d.content_type,
          content_blocks: d.content_blocks,
          featured_image: d.featured_image,
          category: d.category,
          campaign_id: (d as { campaign_id?: string }).campaign_id || "",
          status: d.status,
          scheduled_at: d.status === "published" ? d.scheduled_at : "",
        });
        setDraftRestored(true);
        toast({
          title: "Draft Restored",
          description: "Your draft has been restored successfully.",
          variant: "success",
        });
      } else {
        clearDraft();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (draftRestored) {
      const timer = setTimeout(() => setDraftRestored(false), 2000);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => {
      const hasContent = formData.title || formData.content_blocks?.length || formData.content;
      if (hasContent) {
        saveDraft({
          mode: "write",
          prompt: "",
          promptAnalysis: null,
          formData,
        });
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [formData, draftRestored, saveDraft, setDraftRestored]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const hasContent = formData.title || formData.content_blocks?.length || formData.content;
        if (hasContent) {
          saveDraft({ mode: "write", prompt: "", promptAnalysis: null, formData });
          toast({ title: "Draft Saved", description: "Your work has been saved.", variant: "success" });
        }
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (mode === "write" && formData.title && (formData.content_blocks?.length || formData.content?.trim())) {
          (document.getElementById("blog-form") as HTMLFormElement | null)?.requestSubmit();
        }
        return;
      }
      if (e.key === "Escape") {
        if (showReview) setShowReview(false);
        if (showComparison) setShowComparison(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, formData, showReview, showComparison, saveDraft, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const useBlocks = formData.content_blocks != null && formData.content_blocks.length > 0;
    if (useBlocks) {
      const errs = getContentBlocksValidationErrors(formData.content_blocks || []);
      if (errs.hasBlobUrls) {
        setError("Please wait for all image uploads to finish before saving.");
        return;
      }
      if (errs.missingCaptions) {
        setError("Every image requires a caption before saving.");
        return;
      }
    }

    if (!formData.title) {
      setError("Title is required");
      return;
    }
    if (!useBlocks && !formData.content?.trim()) {
      setError("Post body is required");
      return;
    }

    clearDraft();

    try {
      const submitData = {
        ...formData,
        content: useBlocks ? "" : formData.content,
        content_blocks: useBlocks ? formData.content_blocks : undefined,
        category: formData.category || undefined,
        campaign_id: formData.campaign_id || undefined,
        excerpt: derivedExcerpt(),
      };
      const { scheduled_at, ...blogData } = submitData;
      const willScheduleLater = formData.status === "scheduled";
      const willPublishNow = formData.status === "published";
      if (willScheduleLater && !scheduled_at) {
        setError("Pick a schedule date and time, or change status away from Scheduled.");
        return;
      }
      if ((willPublishNow || willScheduleLater) && publishDestinations.length === 0) {
        setError("Select at least one publish destination.");
        return;
      }
      const createPayload = willScheduleLater || willPublishNow ? { ...blogData, status: "draft" as const } : blogData;
      createBlog.mutate(createPayload, {
        onSuccess: async (response) => {
          if (formData.status === "published") {
            generationTracker.blogPublished();
          } else {
            generationTracker.blogSaved();
          }
          const blogId = response.data?.data?._id || response.data?._id;
          if (blogId && willPublishNow) {
            try {
              await BlogService.publishBlog(blogId, publishDestinations);
            } catch (publishErr: any) {
              setError(publishErr?.response?.data?.message || "Post created but publishing failed");
            }
          }
          if (blogId && willScheduleLater && scheduled_at) {
            try {
              const scheduleDate = new Date(scheduled_at);
              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              await BlogService.scheduleBlog(blogId, scheduleDate, timezone, publishDestinations);
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS }),
              ]);
            } catch (scheduleErr: any) {
              setError(scheduleErr?.response?.data?.message || "Post created but scheduling failed");
            }
          }
        },
      });
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create post";
      setError(errorMessage);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const response = await uploadImage.mutateAsync(file);
      setFormData({ ...formData, featured_image: response.data.data.url });
      setError("");
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to upload image";
      setError(errorMessage);
    }
  };

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    const response = await uploadImage.mutateAsync(file);
    return response.data.data.url;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex-shrink-0">
        <Breadcrumb items={[{ label: "Posts", href: "/dashboard/posts" }, { label: "Create New Post" }]} />
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <h1 className="text-2xl font-display text-white shrink-0">Blank post</h1>
          <p className="text-sm text-gray-500 mt-1">Quiet fallback — most posts start from chat.</p>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 flex-wrap">
            <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1 border border-gray-800 shrink-0">
              <button
                type="button"
                onClick={() => setMode("write")}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  mode === "write" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <PenTool className="w-4 h-4" />
                <span className="text-sm font-medium">Write</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("ai-generate");
                  generationTracker.typeSelected({ generation_type: "ai-generate" });
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  mode === "ai-generate" ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI Generate</span>
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <Button
                type="button"
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                onClick={() => router.push("/dashboard/posts")}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-purple-600 hover:bg-purple-700 text-white border-0 shrink-0"
                onClick={handleReview}
                disabled={isReviewing || !canReviewForm}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isReviewing ? "Reviewing..." : "Review with AI"}
              </Button>
              <Button
                type="submit"
                form="blog-form"
                className="bg-primary hover:bg-primary/90 text-white shrink-0"
                disabled={createBlog.isPending || !canSubmitWriteForm}
              >
                {createBlog.isPending ? "Creating..." : "Create Post"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col gap-10">
          <form id="blog-form" onSubmit={handleSubmit} className="space-y-6 shrink-0">
            {error && (
              <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">{error}</div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              <div className="lg:col-span-2 space-y-6 min-w-0">
                {showReview && activeReviewResult && mode === "write" && (
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      onClick={() => {
                        setReviewPanelTab("content");
                        setReviewHasNewInfo(false);
                      }}
                      className={
                        reviewPanelTab === "content"
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                      }
                    >
                      Post
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        setReviewPanelTab("review");
                        setReviewHasNewInfo(false);
                      }}
                      className={
                        reviewPanelTab === "review"
                          ? "bg-purple-600 hover:bg-purple-700 text-white"
                          : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                      }
                    >
                      Review
                      {reviewHasNewInfo && (
                        <span className="ml-2 inline-flex items-center rounded bg-purple-900/60 px-2 py-0.5 text-xs font-medium text-purple-100">
                          New
                        </span>
                      )}
                    </Button>
                  </div>
                )}

                {reviewPanelTab === "review" && showReview && activeReviewResult && mode === "write" ? (
                  <BlogReviewCard
                    reviewResult={activeReviewResult}
                    originalContent={{
                      title: formData.title,
                      content: formData.content_blocks?.length
                        ? blocksToHtml(formData.content_blocks)
                        : formData.content,
                      excerpt: derivedExcerpt(),
                    }}
                    isLoading={isReviewing}
                    onViewComparison={() => setShowComparison(true)}
                    onApplyReview={async () => {
                      const result = activeReviewResult;
                      const improvedContent = result.improved_content || formData.content;
                      const nextBlocks = contentToBlocks(improvedContent);
                      setFormData({
                        ...formData,
                        title: result.improved_title || formData.title,
                        content_blocks: nextBlocks,
                        content: blocksToHtml(nextBlocks),
                        content_type: "html",
                      });
                      setShowReview(false);
                      setReviewPanelTab("content");
                      setReviewHasNewInfo(false);
                    }}
                  />
                ) : mode === "ai-generate" ? (
                  <AiPostWizard onQueued={handleWizardQueued} onError={(message) => setError(message)} />
                ) : (
                  <>
                    <div>
                      <Label htmlFor="title" className="text-gray-300">
                        Title *
                      </Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="mt-1 bg-black border-gray-700 text-white"
                        required
                        maxLength={200}
                      />
                    </div>

                    <div className="flex-1 min-h-0 min-w-0">
                      <Label htmlFor="content" className="text-gray-300 mb-2 block">
                        Post *
                      </Label>
                      <div className="h-[55vh] min-h-[420px] max-h-[90vh] min-w-0">
                        <BlockEditor
                          value={formData.content_blocks ?? []}
                          onChange={(blocks) => setFormData({ ...formData, content_blocks: blocks })}
                          placeholder="Start writing your post..."
                          onUploadImage={handleEditorImageUpload}
                        />
                      </div>
                      <p className="mt-2 text-xs text-gray-500">
                        Use + or type / to add blocks. Every image requires a caption.
                      </p>
                    </div>
                  </>
                )}
              </div>

              <div className="lg:col-span-1 space-y-6 min-w-0 self-start">
                <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-6">
                  <div className="space-y-2">
                    <Button
                      type="button"
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white border-0"
                      onClick={handleReview}
                      disabled={isReviewing || !canReviewForm}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {isReviewing ? "Reviewing..." : "Review with AI"}
                    </Button>
                    {!canReviewForm && (
                      <p className="text-xs text-gray-500">Add a title and post body to run an AI review.</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="status" className="text-gray-300">
                      Status
                    </Label>
                    <select
                      id="status"
                      value={formData.status}
                      onChange={(e) => {
                        const status = e.target.value as "draft" | "scheduled" | "published" | "unpublished";
                        setFormData({
                          ...formData,
                          status,
                          ...(status !== "scheduled" ? { scheduled_at: "" } : {}),
                        });
                      }}
                      className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                    >
                      <option value="draft">Draft</option>
                      <option value="scheduled">Scheduled</option>
                      <option value="published">Published</option>
                      <option value="unpublished">Unpublished</option>
                    </select>
                  </div>

                  {(formData.status === "published" || formData.status === "scheduled") && (
                    <PublishDestinationPicker
                      destinations={destinations}
                      selected={publishDestinations}
                      onChange={setPublishDestinations}
                    />
                  )}

                  <div>
                    <Label htmlFor="category" className="text-gray-300">
                      Category
                    </Label>
                    <select
                      id="category"
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                    >
                      <option value="">No Category</option>
                      {categories &&
                        categories
                          .filter((cat: any) => cat.is_active)
                          .map((cat: any) => (
                            <option key={cat._id} value={cat._id}>
                              {cat.name}
                            </option>
                          ))}
                    </select>
                  </div>

                  <div>
                    <Label htmlFor="featured_image" className="text-gray-300">
                      Featured Image
                    </Label>
                    <Input
                      id="featured_image"
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="mt-1 bg-black border-gray-700 text-white"
                    />
                    {formData.featured_image && (
                      <div className="mt-2 relative w-full aspect-video">
                        <Image
                          src={formData.featured_image}
                          alt="Featured"
                          fill
                          className="object-cover rounded"
                          unoptimized={formData.featured_image.includes("localhost")}
                        />
                      </div>
                    )}
                  </div>

                  {formData.status === "scheduled" && (
                    <div>
                      <Label htmlFor="scheduled_at" className="text-gray-300 flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        Schedule Publish
                      </Label>
                      <div className="mt-1">
                        <DateTimePicker
                          id="scheduled_at"
                          value={formData.scheduled_at}
                          onChange={(value) => setFormData({ ...formData, scheduled_at: value })}
                          min={new Date().toISOString().slice(0, 16)}
                          aria-label="Schedule publish date and time"
                        />
                      </div>
                      {formData.scheduled_at && (
                        <p className="mt-1 text-xs text-gray-500">
                          Will be published on {new Date(formData.scheduled_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </form>

          {showComparison && activeReviewResult && (
            <BlogReviewComparison
              original={{
                title: formData.title,
                content: formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content,
                excerpt: derivedExcerpt(),
              }}
              reviewResult={activeReviewResult}
              onClose={() => setShowComparison(false)}
              onApplyAll={async () => {
                const result = activeReviewResult;
                const improvedContent = result.improved_content || formData.content;
                const nextBlocks = contentToBlocks(improvedContent);
                setFormData({
                  ...formData,
                  title: result.improved_title || formData.title,
                  content: blocksToHtml(nextBlocks),
                  content_type: "html",
                  content_blocks: nextBlocks,
                });
                setShowComparison(false);
                setShowReview(false);
              }}
            />
          )}

          {(hasDraft || draftRestored) && mode === "write" && (
            <div className="fixed bottom-4 right-4 flex gap-2 z-40">
              <Button
                type="button"
                variant="outline"
                className="bg-gray-900 border-gray-700 text-gray-300"
                onClick={() => {
                  saveDraft({ mode: "write", prompt: "", promptAnalysis: null, formData });
                  toast({ title: "Draft Saved", description: "Your work has been saved.", variant: "success" });
                }}
              >
                <Save className="w-4 h-4 mr-2" />
                Save draft
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="text-gray-400"
                onClick={() => {
                  clearDraft();
                  toast({ title: "Draft cleared", description: "Local draft removed.", variant: "info" });
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear draft
              </Button>
            </div>
          )}

          <p className="text-xs text-gray-600 flex items-center gap-1">
            <Keyboard className="w-3 h-3" />
            ⌘/Ctrl+S save draft · ⌘/Ctrl+Enter create
          </p>
        </div>
      </main>
    </div>
  );
}

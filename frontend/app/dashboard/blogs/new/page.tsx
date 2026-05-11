"use client";

import { useState, useEffect, useCallback } from "react";
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
import { blocksToHtml, canSaveContentBlocks, getContentBlocksValidationErrors } from "@/lib/utils/content-blocks";
import { deriveExcerptFromContent } from "@/lib/utils/blog-excerpt";
import { hasBodyContent, hasTitle } from "@/lib/utils/blog-form-validation";
import { htmlToBlocks } from "@/lib/utils/html-to-blocks";
import { contentToBlocks } from "@/lib/utils/content-to-blocks";
import type { ContentBlock } from "@/lib/types/blog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BlogReviewCard } from "@/components/blog/blog-review-card";
import { BlogReviewComparison } from "@/components/blog/blog-review-comparison";
import { PromptInput } from "@/components/blog/prompt-input";
import { PromptTemplates } from "@/components/blog/prompt-templates";
import { PreGenerationConfirmation } from "@/components/blog/pre-generation-confirmation";
import {
  BlogAiGenerationSettings,
  defaultBlogGenerationFormParams,
} from "@/components/blog/blog-ai-generation-settings";
import { GenerationProgress, GenerationStage } from "@/components/blog/generation-progress";
import { ConfirmModal } from "@/components/ui/modal";
import { useBlogGeneration } from "@/lib/hooks/use-blog-generation";
import { useBlogDraft } from "@/lib/hooks/use-blog-draft";
import { PromptAnalysis } from "@/lib/api/services/blog-generation.service";
import type { BlogGenerationFormParams } from "@/lib/utils/blog-ai-generation-params";
import { formParamsToGenerationHints, mergePromptAnalysisWithForm } from "@/lib/utils/blog-generation-form";
import { Sparkles, PenTool, Save, Trash2, RotateCcw, Undo2, Keyboard, Calendar } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type BlogCreationMode = "write" | "ai-generate";

export default function NewBlogPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasDraft, draftRestored, setDraftRestored, loadDraft, saveDraft, clearDraft } = useBlogDraft();
  const createBlog = useCreateBlog();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const { reviewBlog, reviewBlogAsync, isReviewing, reviewResult, applyReviewAsync } = useBlogReview();
  const { analyzePrompt, generateBlog, cancelRequest, isAnalyzing, isGenerating } = useBlogGeneration();
  const [mode, setMode] = useState<BlogCreationMode>("write");
  const [prompt, setPrompt] = useState("");
  const [generationParams, setGenerationParams] = useState<BlogGenerationFormParams>(() =>
    defaultBlogGenerationFormParams()
  );
  const [promptAnalysis, setPromptAnalysis] = useState<PromptAnalysis | null>(null);
  const [promptError, setPromptError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("analyzing");
  const [autoReviewResult, setAutoReviewResult] = useState<any>(null); // Review from auto-review after generation
  const [showReview, setShowReview] = useState(false);
  const [reviewPanelTab, setReviewPanelTab] = useState<"content" | "review">("content");
  const [reviewHasNewInfo, setReviewHasNewInfo] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [previousContent, setPreviousContent] = useState<{
    title: string;
    content: string;
  } | null>(null);
  const [formData, setFormData] = useState<{
    title: string;
    content: string;
    content_type: "html" | "markdown";
    content_blocks?: ContentBlock[];
    featured_image: string;
    category: string;
    status: "draft" | "scheduled" | "published" | "unpublished";
    scheduled_at: string;
  }>({
    title: "",
    content: "",
    content_type: "html",
    featured_image: "",
    category: "",
    status: "draft",
    scheduled_at: "",
  });

  const canSubmitWriteForm =
    mode === "write" && hasTitle(formData.title) && hasBodyContent(formData);
  const canReviewForm = hasTitle(formData.title) && hasBodyContent(formData);

  const getContentHtml = () =>
    formData.content_blocks != null && formData.content_blocks.length > 0
      ? blocksToHtml(formData.content_blocks)
      : formData.content;

  const derivedExcerpt = () => deriveExcerptFromContent(getContentHtml());
  const [error, setError] = useState("");

  const handleAnalyzePrompt = useCallback(async () => {
    if (!prompt.trim()) {
      setPromptError("Please enter a prompt");
      return;
    }

    setPromptError("");
    try {
      const hints = formParamsToGenerationHints(generationParams);
      const analysis = await analyzePrompt(prompt.trim(), hints);
      const merged = mergePromptAnalysisWithForm(analysis, generationParams);
      setPromptAnalysis(merged);

      if (!analysis.is_valid) {
        setPromptError(analysis.rejection_reason || "Invalid prompt");
      } else {
        // Show confirmation modal after successful analysis
        setShowConfirmation(true);
      }
    } catch (err: any) {
      // Error message is already user-friendly from backend
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to analyze prompt. Please try again.";
      setPromptError(errorMessage);
    }
  }, [prompt, generationParams, analyzePrompt]);

  const handleConfirmGeneration = async (confirmedAnalysis: PromptAnalysis) => {
    setShowConfirmation(false);
    setShowProgress(true);
    setGenerationStage("generating"); // Skip analyzing stage since it's already done

    try {
      const generatedData = await generateBlog(prompt.trim(), confirmedAnalysis);

      setFormData((prev) => ({
        ...prev,
        title: generatedData.content.title,
        content: generatedData.content.content,
        content_blocks: htmlToBlocks(generatedData.content.content),
      }));

      setGenerationStage("complete");

      if (generatedData.review) {
        setAutoReviewResult(generatedData.review);
        setReviewHasNewInfo(true);
      }

      setMode("write");
      setShowProgress(false);

      if (generatedData.review) {
        setReviewPanelTab("content");
        setShowReview(true);
      }
    } catch (err: any) {
      setShowProgress(false);
      setGenerationStage("analyzing"); // Reset to initial stage on error
      // Error message is already user-friendly from backend
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to generate blog content. Please try again.";
      setPromptError(errorMessage);
    }
  };

  const handleCancelGeneration = () => {
    cancelRequest(); // Cancel the actual API request
    setShowProgress(false);
    setGenerationStage("analyzing");
    setPromptError("Generation cancelled by user");
  };

  const handleRegenerateClick = () => {
    if (!prompt.trim() || !promptAnalysis) {
      setPromptError("Cannot regenerate without a valid prompt and analysis");
      return;
    }

    // Store current content as backup before regenerating
    if (formData.title || formData.content || formData.content_blocks?.length) {
      setPreviousContent({
        title: formData.title,
        content: formData.content,
      });
    }

    setShowRegenerateConfirm(true);
  };

  const handleRegenerate = async () => {
    setShowRegenerateConfirm(false);

    if (!prompt.trim() || !promptAnalysis) {
      setPromptError("Cannot regenerate without a valid prompt and analysis");
      return;
    }

    // Store current content as backup before regenerating
    if (formData.title || formData.content || formData.content_blocks?.length) {
      setPreviousContent({
        title: formData.title,
        content: formData.content,
      });
    }

    setShowProgress(true);
    setGenerationStage("analyzing");

    toast({
      title: "Regenerating Content",
      description: "Creating new content based on your prompt...",
      variant: "info",
    });

    try {
      const hints = formParamsToGenerationHints(generationParams);
      const freshAnalysis = await analyzePrompt(prompt.trim(), hints);

      if (!freshAnalysis.is_valid) {
        setPromptError(freshAnalysis.rejection_reason || "Invalid prompt");
        setShowProgress(false);
        setGenerationStage("analyzing"); // Reset stage
        toast({
          title: "Regeneration Failed",
          description: freshAnalysis.rejection_reason || "Invalid prompt",
          variant: "error",
        });
        return;
      }

      const merged = mergePromptAnalysisWithForm(freshAnalysis, generationParams);
      setPromptAnalysis(merged);

      setGenerationStage("generating");
      const generatedData = await generateBlog(prompt.trim(), merged);

      setFormData({
        ...formData,
        title: generatedData.content.title,
        content: generatedData.content.content,
        content_blocks: htmlToBlocks(generatedData.content.content),
      });

      setGenerationStage("complete");

      if (generatedData.review) {
        setAutoReviewResult(generatedData.review);
        setReviewHasNewInfo(true);
        setReviewPanelTab("content");
        setShowReview(true);
      }

      setShowProgress(false);
    } catch (err: any) {
      setShowProgress(false);
      setGenerationStage("analyzing"); // Reset to initial stage on error
      // Error message is already user-friendly from backend
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to regenerate blog content. Please try again.";
      setPromptError(errorMessage);
      toast({
        title: "Regeneration Failed",
        description: errorMessage,
        variant: "error",
      });
    }
  };

  const handleRevertContent = () => {
    if (previousContent) {
      setFormData({
        ...formData,
        title: previousContent.title,
        content: previousContent.content,
        content_blocks: previousContent.content
          ? htmlToBlocks(previousContent.content)
          : formData.content_blocks,
      });
      setPreviousContent(null);
      toast({
        title: "Content Reverted",
        description: "Previous content has been restored.",
        variant: "success",
      });
    }
  };

  const handleReview = async () => {
    const useBlocks = formData.content_blocks != null && formData.content_blocks.length > 0;
    const contentForReview = useBlocks ? blocksToHtml(formData.content_blocks || []) : formData.content;
    if (!formData.title || !contentForReview?.trim()) {
      setError("Title and content are required for review");
      return;
    }

    try {
      await reviewBlogAsync({
        data: {
          title: formData.title,
          content: contentForReview,
          excerpt: derivedExcerpt() || undefined,
          category: formData.category || undefined,
        },
      });
      setAutoReviewResult(null);
      setShowReview(true);
      setReviewHasNewInfo(false);
      setReviewPanelTab("review");
    } catch (err) {
      // Error handled by hook
    }
  };

  useEffect(() => {
    if (mode === "write") {
      setGenerationParams(defaultBlogGenerationFormParams());
    }
  }, [mode]);

  // Load draft on mount
  useEffect(() => {
    const draft = loadDraft();
    if (draft && !draftRestored) {
      // Ask user if they want to restore draft
      const shouldRestore = window.confirm(
        "You have a saved draft. Would you like to restore it?"
      );
      
      if (shouldRestore) {
        setMode(draft.mode);
        setPrompt(draft.prompt);
        setPromptAnalysis(draft.promptAnalysis);
        setGenerationParams(draft.generationParams ?? defaultBlogGenerationFormParams());
        const d = draft.formData;
        setFormData({
          title: d.title,
          content: d.content,
          content_type: d.content_type,
          content_blocks: d.content_blocks,
          featured_image: d.featured_image,
          category: d.category,
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
        // User chose not to restore, clear the draft
        clearDraft();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Auto-save draft (debounced)
  useEffect(() => {
    // Don't save if draft was just restored (to avoid immediate overwrite)
    if (draftRestored) {
      const timer = setTimeout(() => {
        setDraftRestored(false);
      }, 2000);
      return () => clearTimeout(timer);
    }

    // Debounce draft saving
    const timer = setTimeout(() => {
      // Only save if there's meaningful content
      const hasContent = 
        (mode === "write" && (formData.title || formData.content_blocks?.length || formData.content)) ||
        (mode === "ai-generate" && prompt.trim());
      
      if (hasContent) {
        saveDraft({
          mode,
          prompt,
          promptAnalysis,
          generationParams: mode === "ai-generate" ? generationParams : undefined,
          formData,
        });
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [mode, prompt, promptAnalysis, generationParams, formData, draftRestored, saveDraft, clearDraft]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S: Save draft manually
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        const hasContent = 
          (mode === "write" && (formData.title || formData.content_blocks?.length || formData.content)) ||
          (mode === "ai-generate" && prompt.trim());
        
        if (hasContent) {
          saveDraft({
            mode,
            prompt,
            promptAnalysis,
            generationParams: mode === "ai-generate" ? generationParams : undefined,
            formData,
          });
          toast({
            title: "Draft Saved",
            description: "Your work has been saved.",
            variant: "success",
          });
        }
        return;
      }

      // Cmd/Ctrl + Enter: Analyze prompt (AI mode) or Submit form (Write mode)
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        if (mode === "ai-generate" && prompt.trim() && !isAnalyzing) {
          handleAnalyzePrompt();
        } else if (mode === "write" && formData.title && (formData.content_blocks?.length || formData.content?.trim())) {
          const form = document.getElementById("blog-form") as HTMLFormElement;
          if (form) {
            form.requestSubmit();
          }
        }
        return;
      }

      // Cmd/Ctrl + K: Open templates
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (mode === "ai-generate") {
          setShowTemplates(true);
        }
        return;
      }

      // Escape: Close modals
      if (e.key === "Escape") {
        if (showTemplates) {
          setShowTemplates(false);
        }
        if (showConfirmation) {
          setShowConfirmation(false);
        }
        if (showRegenerateConfirm) {
          setShowRegenerateConfirm(false);
        }
        if (showReview) {
          setShowReview(false);
        }
        if (showComparison) {
          setShowComparison(false);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    mode,
    prompt,
    formData,
    isAnalyzing,
    showTemplates,
    showConfirmation,
    showRegenerateConfirm,
    showReview,
    showComparison,
    saveDraft,
    promptAnalysis,
    handleAnalyzePrompt,
    generationParams,
    toast,
  ]);

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
      setError("Content is required");
      return;
    }

    // Clear draft before submitting
    clearDraft();

    try {
      const submitData = {
        ...formData,
        content: useBlocks ? "" : formData.content,
        content_blocks: useBlocks ? formData.content_blocks : undefined,
        category: formData.category || undefined,
        excerpt: derivedExcerpt(),
      };
      const { scheduled_at, ...blogData } = submitData;
      const willScheduleLater = formData.status === "scheduled";
      if (willScheduleLater && !scheduled_at) {
        setError("Pick a schedule date and time, or change status away from Scheduled.");
        return;
      }
      const createPayload = willScheduleLater ? { ...blogData, status: "draft" as const } : blogData;
      createBlog.mutate(createPayload, {
        onSuccess: async (response) => {
          const blogId = response.data?.data?._id || response.data?._id;
          if (blogId && willScheduleLater && scheduled_at) {
            try {
              const scheduleDate = new Date(scheduled_at);
              const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
              await BlogService.scheduleBlog(blogId, scheduleDate, timezone);
              await Promise.all([
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS }),
                queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS }),
              ]);
            } catch (scheduleErr: any) {
              console.error("Failed to schedule blog:", scheduleErr);
              setError(scheduleErr?.response?.data?.message || "Blog created but scheduling failed");
            }
          }
        },
      });
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create blog";
      setError(errorMessage);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadImage.mutateAsync(file);
      const imageUrl = response.data.data.url;
      setFormData({ ...formData, featured_image: imageUrl });
      setError(""); // Clear any previous errors
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to upload image";
      setError(errorMessage);
      console.error("Image upload error:", err);
    }
  };

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    const response = await uploadImage.mutateAsync(file);
    return response.data.data.url;
  };

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex-shrink-0">
        <Breadcrumb
          items={[
            { label: "Blogs", href: "/dashboard/blogs" },
            { label: "Create New Blog" },
          ]}
        />
          <div className="flex justify-between items-center">
          <h1 className="text-2xl font-display text-white">Create New Blog</h1>
          
          {/* Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-900 rounded-lg p-1 border border-gray-800">
            <button
              type="button"
              onClick={() => setMode("write")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                mode === "write"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <PenTool className="w-4 h-4" />
              <span className="text-sm font-medium">Write</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("ai-generate")}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                mode === "ai-generate"
                  ? "bg-purple-600 text-white"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span className="text-sm font-medium">AI Generate</span>
            </button>
          </div>
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              onClick={() => router.push("/dashboard/blogs")}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-purple-600 hover:bg-purple-700 text-white border-0"
              onClick={handleReview}
              disabled={isReviewing || !canReviewForm}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isReviewing ? "Reviewing..." : "Review with AI"}
            </Button>
            <Button
              type="submit"
              form="blog-form"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={createBlog.isPending || !canSubmitWriteForm}
            >
              {createBlog.isPending ? "Creating..." : "Create Blog"}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex flex-col gap-10">
          <form id="blog-form" onSubmit={handleSubmit} className="space-y-6 shrink-0">
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6 min-w-0">
              {mode === "ai-generate" ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">AI Blog Generation</h3>
                    <Button
                      type="button"
                      onClick={() => setShowTemplates(true)}
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Browse Templates
                    </Button>
                  </div>
                  <BlogAiGenerationSettings
                    value={generationParams}
                    onChange={setGenerationParams}
                    disabled={isAnalyzing || isGenerating}
                  />
                  <PromptInput
                    value={prompt}
                    onChange={setPrompt}
                    onAnalyze={handleAnalyzePrompt}
                    isAnalyzing={isAnalyzing}
                    error={promptError}
                  />
                  {promptAnalysis && promptAnalysis.is_valid && (
                    <div className="rounded-md bg-green-900/20 border border-green-800 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm text-green-400 font-medium">Prompt Analysis Complete</p>
                        <div className="flex items-center gap-2">
                          {(formData.content_blocks?.length || formData.content) && (
                            <>
                              <Button
                                type="button"
                                onClick={handleRegenerateClick}
                                disabled={isGenerating || isAnalyzing}
                                className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 h-auto"
                              >
                                <RotateCcw className="w-3 h-3 mr-1" />
                                {isGenerating || isAnalyzing ? "Regenerating..." : "Regenerate"}
                              </Button>
                              {previousContent && (
                                <Button
                                  type="button"
                                  onClick={handleRevertContent}
                                  className="bg-gray-700 hover:bg-gray-600 text-white text-xs px-3 py-1 h-auto"
                                  title="Revert to previous content"
                                >
                                  <Undo2 className="w-3 h-3 mr-1" />
                                  Revert
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Topic:</span>
                          <span className="text-white ml-2">{promptAnalysis.topic}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Domain:</span>
                          <span className="text-white ml-2">{promptAnalysis.domain}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Audience:</span>
                          <span className="text-white ml-2">{promptAnalysis.target_audience}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Purpose:</span>
                          <span className="text-white ml-2">{promptAnalysis.purpose}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {showReview && (reviewResult || autoReviewResult) && (
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={() => {
                          setReviewPanelTab("content");
                          setReviewHasNewInfo(false);
                        }}
                        disabled={isGenerating || isAnalyzing}
                        className={`${
                          reviewPanelTab === "content"
                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                            : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                        }`}
                      >
                        Content
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setReviewPanelTab("review");
                          setReviewHasNewInfo(false);
                        }}
                        disabled={isGenerating || isAnalyzing}
                        className={`${
                          reviewPanelTab === "review"
                            ? "bg-purple-600 hover:bg-purple-700 text-white"
                            : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                        }`}
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

                  {reviewPanelTab === "review" && showReview && (reviewResult || autoReviewResult) ? (
                    <BlogReviewCard
                      reviewResult={reviewResult || autoReviewResult}
                      originalContent={{
                        title: formData.title,
                        content: formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content,
                        excerpt: derivedExcerpt(),
                      }}
                      isLoading={false}
                      onViewComparison={() => setShowComparison(true)}
                      onApplyReview={async () => {
                        const result = reviewResult || autoReviewResult;
                        const improvedContent = result.improved_content || formData.content;
                        try {
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
                        } catch (err) {
                          // Error handled by hook
                        }
                      }}
                    />
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
                      Content *
                    </Label>
                    <div className="h-[55vh] min-h-[420px] max-h-[90vh] min-w-0">
                      <BlockEditor
                        value={formData.content_blocks ?? []}
                        onChange={(blocks) => setFormData({ ...formData, content_blocks: blocks })}
                        placeholder="Start writing your blog post..."
                        onUploadImage={handleEditorImageUpload}
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Use + or type / to add blocks. Every image requires a caption.
                    </p>
                  </div>
                  </>
                  )}
                </>
              )}
            </div>

            <div className="lg:col-span-1 space-y-6 min-w-0 self-start">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-6">
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

          {/* Review section moved into content/review tabs above */}

          {/* Comparison Modal */}
          {showComparison && (reviewResult || autoReviewResult) && (
            <BlogReviewComparison
              original={{
                title: formData.title,
                content: formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content,
                excerpt: derivedExcerpt(),
              }}
              reviewResult={reviewResult || autoReviewResult}
              onClose={() => setShowComparison(false)}
              onApplyAll={async () => {
                const result = reviewResult || autoReviewResult;
                const improvedContent = result.improved_content || formData.content;
                  const nextBlocks = contentToBlocks(improvedContent);
                  const normalizedHtml = blocksToHtml(nextBlocks);
                setFormData({
                  ...formData,
                  title: result.improved_title || formData.title,
                    content: normalizedHtml,
                    content_type: "html",
                    content_blocks: nextBlocks,
                });
                setShowComparison(false);
                setShowReview(false);
              }}
            />
          )}

          {/* Pre-Generation Confirmation Modal */}
          {promptAnalysis && (
            <PreGenerationConfirmation
              isOpen={showConfirmation}
              onClose={() => setShowConfirmation(false)}
              onConfirm={handleConfirmGeneration}
              initialAnalysis={mergePromptAnalysisWithForm(promptAnalysis, generationParams)}
              isGenerating={isGenerating}
            />
          )}

          {/* Generation Progress Modal */}
          <GenerationProgress
            isOpen={showProgress}
            onCancel={handleCancelGeneration}
            currentStage={generationStage}
            canCancel={generationStage !== "complete"}
          />

          {/* Prompt Templates Modal */}
          {showTemplates && (
            <PromptTemplates
              onSelectTemplate={(templatePrompt) => {
                setPrompt(templatePrompt);
                setShowTemplates(false);
              }}
              onClose={() => setShowTemplates(false)}
            />
          )}

          {/* Regenerate Confirmation Modal */}
          <ConfirmModal
            isOpen={showRegenerateConfirm}
            onClose={() => setShowRegenerateConfirm(false)}
            onConfirm={handleRegenerate}
            title="Regenerate Content?"
            message="This will replace your current content with newly generated content. Your current content will be saved so you can revert if needed. Continue?"
            confirmText="Regenerate"
            cancelText="Cancel"
            variant="default"
          />
        </div>
      </main>
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { useCategories } from "@/lib/hooks/use-category";
import { useBlogReview } from "@/lib/hooks/use-blog-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BlogReviewCard } from "@/components/blog/blog-review-card";
import { BlogReviewComparison } from "@/components/blog/blog-review-comparison";
import { PromptInput } from "@/components/blog/prompt-input";
import { PromptTemplates } from "@/components/blog/prompt-templates";
import { PreGenerationConfirmation } from "@/components/blog/pre-generation-confirmation";
import { GenerationProgress, GenerationStage } from "@/components/blog/generation-progress";
import { useBlogGeneration } from "@/lib/hooks/use-blog-generation";
import { useBlogDraft } from "@/lib/hooks/use-blog-draft";
import { PromptAnalysis } from "@/lib/api/services/blog-generation.service";
import { Sparkles, PenTool, Save, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type BlogCreationMode = "write" | "ai-generate";

export default function NewBlogPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { hasDraft, draftRestored, setDraftRestored, loadDraft, saveDraft, clearDraft } = useBlogDraft();
  const createBlog = useCreateBlog();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const { reviewBlog, reviewBlogAsync, isReviewing, reviewResult, applyReviewAsync } = useBlogReview();
  const { analyzePrompt, generateBlog, cancelRequest, isAnalyzing, isGenerating, generationResult } = useBlogGeneration();
  const [mode, setMode] = useState<BlogCreationMode>("write");
  const [prompt, setPrompt] = useState("");
  const [promptAnalysis, setPromptAnalysis] = useState<PromptAnalysis | null>(null);
  const [promptError, setPromptError] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("analyzing");
  const [autoReviewResult, setAutoReviewResult] = useState<any>(null); // Review from auto-review after generation
  const [showReview, setShowReview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_type: "html" as "html" | "markdown", // Rich text editor always outputs HTML
    excerpt: "",
    featured_image: "",
    category: "",
    status: "draft" as "draft" | "published" | "unpublished",
  });
  const [error, setError] = useState("");

  const handleAnalyzePrompt = async () => {
    if (!prompt.trim()) {
      setPromptError("Please enter a prompt");
      return;
    }

    setPromptError("");
    try {
      const analysis = await analyzePrompt(prompt.trim());
      setPromptAnalysis(analysis);

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
  };

  const handleConfirmGeneration = async (confirmedAnalysis: PromptAnalysis) => {
    setShowConfirmation(false);
    setShowProgress(true);
    setGenerationStage("generating"); // Skip analyzing stage since it's already done

    try {
      // Generate blog content (includes auto-review in backend)
      const generatedData = await generateBlog(prompt.trim(), confirmedAnalysis);

      // Update form data with generated content
      setFormData({
        ...formData,
        title: generatedData.content.title,
        content: generatedData.content.content,
        excerpt: generatedData.content.excerpt,
      });

      // Stage: Complete (review happens automatically in backend)
      setGenerationStage("complete");
      
      // Store auto-review result if available (auto-review from backend)
      if (generatedData.review) {
        setAutoReviewResult(generatedData.review);
      }

      // Show warning if review failed but generation succeeded
      if (generatedData.reviewError) {
        // Don't show error toast - generation was successful
        // User can manually review using the "Review with AI" button
        console.warn("Auto-review unavailable:", generatedData.reviewError.message);
      }

      // Switch to write mode to show the generated content
      setMode("write");
      setShowProgress(false);
      
      // Auto-show review if available from generation
      if (generatedData.review) {
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

  const handleRegenerate = async () => {
    if (!prompt.trim() || !promptAnalysis) {
      setPromptError("Cannot regenerate without a valid prompt and analysis");
      return;
    }

    setShowProgress(true);
    setGenerationStage("analyzing");

    try {
      // Stage 1: Re-analyze prompt
      const freshAnalysis = await analyzePrompt(prompt.trim());
      
      if (!freshAnalysis.is_valid) {
        setPromptError(freshAnalysis.rejection_reason || "Invalid prompt");
        setShowProgress(false);
        setGenerationStage("analyzing"); // Reset stage
        return;
      }

      // Update prompt analysis with fresh analysis
      setPromptAnalysis(freshAnalysis);

      // Stage 2: Generate blog content with fresh analysis
      setGenerationStage("generating");
      const generatedData = await generateBlog(prompt.trim(), freshAnalysis);

      // Update form data with new generated content
      setFormData({
        ...formData,
        title: generatedData.content.title,
        content: generatedData.content.content,
        excerpt: generatedData.content.excerpt,
      });

      // Stage 3: Complete (review happens automatically in backend)
      setGenerationStage("complete");

      // Store auto-review result if available
      if (generatedData.review) {
        setAutoReviewResult(generatedData.review);
        setShowReview(true);
      }

      // Show warning if review failed but generation succeeded
      if (generatedData.reviewError) {
        // Don't show error toast - generation was successful
        // User can manually review using the "Review with AI" button
        console.warn("Auto-review unavailable:", generatedData.reviewError.message);
      }

      // Close progress modal after a brief moment to show completion
      setTimeout(() => {
        setShowProgress(false);
      }, 1000); // Short delay just to show completion state
    } catch (err: any) {
      setShowProgress(false);
      setGenerationStage("analyzing"); // Reset to initial stage on error
      // Error message is already user-friendly from backend
      const errorMessage = err?.response?.data?.message || err?.message || "Failed to regenerate blog content. Please try again.";
      setPromptError(errorMessage);
    }
  };

  const handleReview = async () => {
    if (!formData.title || !formData.content) {
      setError("Title and content are required for review");
      return;
    }

    try {
      await reviewBlogAsync({
        data: {
          title: formData.title,
          content: formData.content,
          excerpt: formData.excerpt || undefined,
          category: formData.category || undefined,
        },
      });
      setShowReview(true);
    } catch (err) {
      // Error handled by hook
    }
  };

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
        setFormData(draft.formData);
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
        (mode === "write" && (formData.title || formData.content)) ||
        (mode === "ai-generate" && prompt.trim());
      
      if (hasContent) {
        saveDraft({
          mode,
          prompt,
          promptAnalysis,
          formData,
        });
      }
    }, 2000); // Save after 2 seconds of inactivity

    return () => clearTimeout(timer);
  }, [mode, prompt, promptAnalysis, formData, draftRestored, saveDraft, clearDraft]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.content) {
      setError("Title and content are required");
      return;
    }

    // Clear draft before submitting
    clearDraft();

    try {
      const submitData = {
        ...formData,
        category: formData.category || undefined,
      };
      createBlog.mutate(submitData);
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

  // Handle image uploads from the rich text editor
  useEffect(() => {
    const handleEditorImageUpload = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { file, resolve, reject } = customEvent.detail;

      try {
        const response = await uploadImage.mutateAsync(file);
        const imageUrl = response.data.data.url;
        resolve(imageUrl);
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to upload image";
        reject(new Error(errorMessage));
        console.error("Editor image upload error:", err);
      }
    };

    window.addEventListener("upload-image" as any, handleEditorImageUpload);

    return () => {
      window.removeEventListener("upload-image" as any, handleEditorImageUpload);
    };
  }, [uploadImage]);

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
              disabled={isReviewing || !formData.title || !formData.content}
            >
              <Sparkles className="w-4 h-4 mr-2" />
              {isReviewing ? "Reviewing..." : "Review with AI"}
            </Button>
            <Button
              type="submit"
              form="blog-form"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={createBlog.isPending}
            >
              {createBlog.isPending ? "Creating..." : "Create Blog"}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <form id="blog-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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
                        {formData.content && (
                          <Button
                            type="button"
                            onClick={handleRegenerate}
                            disabled={isGenerating}
                            className="bg-purple-600 hover:bg-purple-700 text-white text-xs px-3 py-1 h-auto"
                          >
                            <Sparkles className="w-3 h-3 mr-1" />
                            {isGenerating ? "Regenerating..." : "Regenerate"}
                          </Button>
                        )}
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

                  <div className="flex-1 min-h-0">
                    <Label htmlFor="content" className="text-gray-300 mb-2 block">
                      Content *
                    </Label>
                    <div className="h-[calc(100vh-500px)] min-h-[600px]">
                      <RichTextEditor
                        value={formData.content}
                        onChange={(value) => setFormData({ ...formData, content: value })}
                        placeholder="Start writing your blog post..."
                      />
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Use the toolbar to format your text, add headers, lists, images, and more.
                    </p>
                  </div>
                </>
              )}
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-6">
                <div>
                  <Label htmlFor="status" className="text-gray-300">
                    Status
                  </Label>
                  <select
                    id="status"
                    value={formData.status}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        status: e.target.value as "draft" | "published" | "unpublished",
                      })
                    }
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  >
                    <option value="draft">Draft</option>
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
                  <Label htmlFor="excerpt" className="text-gray-300">
                    Excerpt
                  </Label>
                  <textarea
                    id="excerpt"
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className="mt-1 flex min-h-[100px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-gray-500">{formData.excerpt.length}/500</p>
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
              </div>
            </div>
          </div>

          </form>

          {/* Review Results */}
          {showReview && (reviewResult || autoReviewResult) && (
            <div className="mt-6">
              <BlogReviewCard
                reviewResult={reviewResult || autoReviewResult}
                originalContent={{
                  title: formData.title,
                  content: formData.content,
                  excerpt: formData.excerpt,
                }}
                isLoading={false}
                onViewComparison={() => setShowComparison(true)}
                onApplyReview={async (selectedSuggestions, applyAll) => {
                  // For new blogs, just update the form data directly
                  // The blog hasn't been created yet, so we can't call the API
                  const result = reviewResult || autoReviewResult;
                  try {
                    if (applyAll) {
                      // Update form data with all improvements
                      setFormData({
                        ...formData,
                        title: result.improved_title || formData.title,
                        content: result.improved_content || formData.content,
                        excerpt: result.improved_excerpt || formData.excerpt,
                      });
                    } else {
                      // Apply selected suggestions (for now, apply all improvements)
                      // TODO: Implement selective application based on selected suggestions
                      setFormData({
                        ...formData,
                        title: result.improved_title || formData.title,
                        content: result.improved_content || formData.content,
                        excerpt: result.improved_excerpt || formData.excerpt,
                      });
                    }
                    setShowReview(false);
                  } catch (err) {
                    // Error handled by hook
                  }
                }}
              />
            </div>
          )}

          {/* Comparison Modal */}
          {showComparison && (reviewResult || autoReviewResult) && (
            <BlogReviewComparison
              original={{
                title: formData.title,
                content: formData.content,
                excerpt: formData.excerpt,
              }}
              reviewResult={reviewResult || autoReviewResult}
              onClose={() => setShowComparison(false)}
              onApplyAll={async () => {
                // For new blogs, just update the form data directly
                const result = reviewResult || autoReviewResult;
                setFormData({
                  ...formData,
                  title: result.improved_title || formData.title,
                  content: result.improved_content || formData.content,
                  excerpt: result.improved_excerpt || formData.excerpt,
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
              initialAnalysis={promptAnalysis}
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
        </div>
      </main>
    </div>
  );
}


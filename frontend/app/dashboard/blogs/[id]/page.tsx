"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useBlog, useUpdateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { useCategories } from "@/lib/hooks/use-category";
import { useBlogReview } from "@/lib/hooks/use-blog-review";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { blocksToHtml, getContentBlocksValidationErrors } from "@/lib/utils/content-blocks";
import { htmlToBlocks } from "@/lib/utils/html-to-blocks";
import type { ContentBlock } from "@/lib/types/blog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { BlogReviewCard } from "@/components/blog/blog-review-card";
import { BlogReviewComparison } from "@/components/blog/blog-review-comparison";
import { ReviewModeView } from "@/components/blog/review-mode-view";
import { Sparkles } from "lucide-react";
import type { ReviewSuggestion } from "@/lib/api/services/blog-review.service";

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: blog, isLoading } = useBlog(id);
  const updateBlog = useUpdateBlog();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const {
    reviewBlog,
    reviewBlogAsync,
    isReviewing,
    reviewResult,
    applyReviewAsync,
    applyOneAsync,
    isApplyingOne,
    restoreVersionAsync,
    isRestoring,
  } = useBlogReview();
  const [showReview, setShowReview] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(new Set());
  const [formData, setFormData] = useState<{
    title: string;
    content: string;
    content_type: "html" | "markdown";
    content_blocks?: ContentBlock[];
    excerpt: string;
    featured_image: string;
    category: string;
    status: "draft" | "published" | "unpublished";
  }>({
    title: "",
    content: "",
    content_type: "html",
    excerpt: "",
    featured_image: "",
    category: "",
    status: "draft",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (blog) {
      // Handle category - it might be an object with _id or a string
      let categoryId = "";
      if ((blog as any).category) {
        if (typeof (blog as any).category === "string") {
          categoryId = (blog as any).category;
        } else if ((blog as any).category._id) {
          categoryId = (blog as any).category._id;
        } else if ((blog as any).category.toString) {
          categoryId = (blog as any).category.toString();
        }
      }

      const existingBlocks = (blog as { content_blocks?: ContentBlock[] }).content_blocks;
      const content_blocks =
        existingBlocks && existingBlocks.length > 0 ? existingBlocks : htmlToBlocks(blog.content || "");
      setFormData({
        title: blog.title || "",
        content: blog.content || "",
        content_type: blog.content_type || "html",
        content_blocks,
        excerpt: blog.excerpt || "",
        featured_image: blog.featured_image || "",
        category: categoryId,
        status: blog.status || "draft",
      });
    }
  }, [blog]);

  const handleReview = async () => {
    const useBlocks = formData.content_blocks != null && formData.content_blocks.length > 0;
    const contentForReview = useBlocks ? blocksToHtml(formData.content_blocks) : formData.content;
    if (!formData.title || !contentForReview?.trim()) {
      setError("Title and content are required for review");
      return;
    }

    // Only allow review for draft posts
    if (blog?.status !== "draft") {
      setError("Only draft blog posts can be reviewed");
      return;
    }

    try {
      setAppliedSuggestionIds(new Set());
      await reviewBlogAsync({
        blogId: id,
        data: {
          title: formData.title,
          content: contentForReview,
          excerpt: formData.excerpt || undefined,
          category: formData.category || undefined,
          content_blocks: useBlocks ? formData.content_blocks : undefined,
        },
      });
      setShowReview(true);
    } catch (err) {
      // Error handled by hook
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const useBlocks = formData.content_blocks != null && formData.content_blocks.length > 0;
    if (useBlocks) {
      const errs = getContentBlocksValidationErrors(formData.content_blocks);
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

    try {
      const payload = useBlocks
        ? { ...formData, content: "", content_blocks: formData.content_blocks }
        : formData;
      updateBlog.mutate({ id, data: payload });
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update blog";
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Blog not found</p>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => router.push("/dashboard/blogs")}
          >
            Back to Blogs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex-shrink-0">
        <Breadcrumb
          items={[
            { label: "Blogs", href: "/dashboard/blogs" },
            { label: blog?.title || "Edit Blog" },
          ]}
        />
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-display text-white">Edit Blog</h1>
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              onClick={() => router.push("/dashboard/blogs")}
            >
              Cancel
            </Button>
            {blog?.status === "draft" && (
              <Button
                type="button"
                className="bg-purple-600 hover:bg-purple-700 text-white border-0"
                onClick={handleReview}
                disabled={isReviewing || !formData.title || !(formData.content_blocks?.length ? true : formData.content?.trim())}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                {isReviewing ? "Reviewing..." : "Review with AI"}
              </Button>
            )}
            <Button
              type="submit"
              form="blog-form"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={updateBlog.isPending}
            >
              {updateBlog.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          {reviewMode && reviewResult ? (
            <ReviewModeView
              title={formData.title}
              excerpt={formData.excerpt}
              content={formData.content}
              content_blocks={formData.content_blocks}
              reviewResult={reviewResult}
              appliedSuggestionIds={appliedSuggestionIds}
              onApplySuggestion={async (suggestion: ReviewSuggestion) => {
                const sid = suggestion.id ?? String(reviewResult.suggestions.indexOf(suggestion));
                const target = suggestion.target ?? (formData.title.includes(suggestion.original) ? "title" : formData.excerpt.includes(suggestion.original) ? "excerpt" : "content");
                try {
                  await applyOneAsync({
                    blogId: id,
                    data: {
                      suggestion_id: sid,
                      target,
                      original: suggestion.original,
                      suggestion: suggestion.suggestion,
                      blockId: suggestion.blockId,
                      blockIndex: suggestion.blockIndex,
                    },
                  });
                  setAppliedSuggestionIds((prev) => new Set(prev).add(sid));
                } catch (_) {
                  // Handled by hook
                }
              }}
              onExitReviewMode={() => setReviewMode(false)}
              isApplyingOne={isApplyingOne}
            />
          ) : (
          <>
          <form id="blog-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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

                {/* Version history - undo after apply-one or apply all */}
                {((blog as { version_history?: { version: number; created_at: Date }[] })?.version_history?.length ??
                  0) > 0 && (
                  <div className="border-t border-gray-800 pt-4">
                    <Label className="text-gray-300">Version history</Label>
                    <p className="text-xs text-gray-500 mt-0.5 mb-2">
                      Restore a previous version (e.g. undo after applying review)
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {[
                        ...(blog as { version_history?: { version: number; created_at: Date }[] }).version_history!,
                      ]
                        .sort((a, b) => b.version - a.version)
                        .map((v) => (
                          <div
                            key={v.version}
                            className="flex items-center justify-between gap-2 rounded border border-gray-700 bg-gray-800/50 px-2 py-1.5 text-sm"
                          >
                            <span className="text-gray-400 truncate">
                              Version {v.version}
                              {v.created_at &&
                                ` · ${new Date(v.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}`}
                            </span>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="shrink-0 border-gray-600 text-gray-300 hover:bg-gray-700 h-7 text-xs"
                              disabled={isRestoring}
                              onClick={async () => {
                                try {
                                  await restoreVersionAsync({ blogId: id, version: v.version });
                                } catch (_) {
                                  // Handled by hook
                                }
                              }}
                            >
                              {isRestoring ? "Restoring…" : "Restore"}
                            </Button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          </form>

          {/* Review Results */}

          {showReview && reviewResult && !reviewMode && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setReviewMode(true)}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  Enter review mode
                </Button>
                <span className="text-sm text-gray-500">
                  Apply suggestions in context and use version history to undo
                </span>
              </div>
              <BlogReviewCard
                reviewResult={reviewResult}
                originalContent={{
                  title: formData.title,
                  content: formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content,
                  excerpt: formData.excerpt,
                }}
                isLoading={false}
                onViewComparison={() => setShowComparison(true)}
                onApplyReview={async (selectedSuggestions, applyAll) => {
                  try {
                    if (applyAll) {
                      // Apply all improvements
                      await applyReviewAsync({
                        blogId: id,
                        data: {
                          improved_content: reviewResult.improved_content,
                          improved_title: reviewResult.improved_title,
                          improved_excerpt: reviewResult.improved_excerpt,
                        },
                      });
                      const improvedContent = reviewResult.improved_content || (formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content);
                      setFormData({
                        ...formData,
                        title: reviewResult.improved_title || formData.title,
                        content: improvedContent,
                        content_blocks: htmlToBlocks(improvedContent),
                        excerpt: reviewResult.improved_excerpt || formData.excerpt,
                      });
                    } else {
                      // Apply selected suggestions (for now, apply all improvements)
                      // TODO: Implement selective application based on selected suggestions
                      await applyReviewAsync({
                        blogId: id,
                        data: {
                          improved_content: reviewResult.improved_content,
                          improved_title: reviewResult.improved_title,
                          improved_excerpt: reviewResult.improved_excerpt,
                        },
                      });
                      const improvedContent = reviewResult.improved_content || (formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content);
                      setFormData({
                        ...formData,
                        title: reviewResult.improved_title || formData.title,
                        content: improvedContent,
                        content_blocks: htmlToBlocks(improvedContent),
                        excerpt: reviewResult.improved_excerpt || formData.excerpt,
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
          {showComparison && reviewResult && (
            <BlogReviewComparison
              original={{
                title: formData.title,
                content: formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content,
                excerpt: formData.excerpt,
              }}
              reviewResult={reviewResult}
              onClose={() => setShowComparison(false)}
              onApplyAll={async () => {
                try {
                  await applyReviewAsync({
                    blogId: id,
                    data: {
                      improved_content: reviewResult.improved_content,
                      improved_title: reviewResult.improved_title,
                      improved_excerpt: reviewResult.improved_excerpt,
                    },
                  });
                  const improvedContent = reviewResult.improved_content || (formData.content_blocks?.length ? blocksToHtml(formData.content_blocks) : formData.content);
                  setFormData({
                    ...formData,
                    title: reviewResult.improved_title || formData.title,
                    content: improvedContent,
                    content_blocks: htmlToBlocks(improvedContent),
                    excerpt: reviewResult.improved_excerpt || formData.excerpt,
                  });
                  setShowComparison(false);
                  setShowReview(false);
                } catch (err) {
                  // Error handled by hook
                }
              }}
            />
          )}
          </>
          )}
        </div>
      </main>
    </div>
  );
}


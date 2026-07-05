"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2, Sparkles, Trash2 } from "lucide-react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { BlogService } from "@/lib/api/services/blog.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useUploadImage } from "@/lib/hooks/use-blog";
import { useCategories } from "@/lib/hooks/use-category";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import type { OrchestratorArtifact } from "@/lib/utils/orchestrator-artifacts";
import type { ContentBlock } from "@/lib/types/blog";
import { blocksToHtml } from "@/lib/utils/content-blocks";
import { deriveExcerptFromContent } from "@/lib/utils/blog-excerpt";
import { htmlToBlocks } from "@/lib/utils/html-to-blocks";
import { cn } from "@/lib/utils/cn";

interface BlogDraftResultEditorProps {
  artifact: OrchestratorArtifact;
  className?: string;
}

type BlogStatus = "draft" | "scheduled" | "published" | "unpublished";

export function BlogDraftResultEditor({ artifact, className }: BlogDraftResultEditorProps) {
  const { setSelectionContext, closeResultsPanel } = useOrchestrator();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const contentRef = useRef<HTMLDivElement>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(
    null
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const data = artifact.outputData;
  const blogId =
    typeof data.blog_id === "string"
      ? data.blog_id
      : typeof data.id === "string"
        ? data.id
        : undefined;

  const { data: blogResponse, isLoading } = useQuery({
    queryKey: blogId ? QUERY_KEYS.BLOG(blogId) : ["blog", "none"],
    queryFn: async () => {
      const res = await BlogService.getBlogById(blogId as string);
      return res.data?.data ?? res.data;
    },
    enabled: !!blogId,
  });

  const [title, setTitle] = useState("");
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [featuredImage, setFeaturedImage] = useState("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<BlogStatus>("draft");
  const [initialized, setInitialized] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (initialized) return;
    if (blogResponse) {
      setTitle(blogResponse.title ?? "");
      const existingBlocks = (blogResponse as { content_blocks?: ContentBlock[] }).content_blocks;
      if (existingBlocks && existingBlocks.length > 0) {
        setContentBlocks(existingBlocks);
      } else {
        setContentBlocks(htmlToBlocks(blogResponse.content ?? ""));
      }
      setFeaturedImage(blogResponse.featured_image ?? "");
      const rawCategory = (blogResponse as { category?: string | { _id?: string } }).category;
      if (typeof rawCategory === "string") {
        setCategory(rawCategory);
      } else if (rawCategory?._id) {
        setCategory(rawCategory._id);
      }
      setStatus((blogResponse.status as BlogStatus) ?? "draft");
      setInitialized(true);
      return;
    }
    if (!blogId) {
      setTitle(typeof data.title === "string" ? data.title : "");
      const content = typeof data.content === "string" ? data.content : "";
      setContentBlocks(htmlToBlocks(content));
      setInitialized(true);
    }
  }, [blogResponse, blogId, data, initialized]);

  const saveMutation = useMutation({
    mutationFn: () => {
      const html = blocksToHtml(contentBlocks);
      const excerpt = deriveExcerptFromContent(html);
      return BlogService.updateBlog(blogId as string, {
        title,
        excerpt,
        content: "",
        featured_image: featuredImage || undefined,
        category: category || undefined,
        status,
        content_blocks: contentBlocks.map((b, i) => ({
          id: (b as { id?: string; _id?: string }).id ?? (b as { _id?: string })._id ?? `block-${i}`,
          type: b.type,
          data: {
            ...b.data,
            level: b.data?.level != null ? Number(b.data.level) : undefined,
          },
        })),
      });
    },
    onSuccess: () => {
      if (blogId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(blogId) });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => BlogService.deleteBlog(blogId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
      setShowDeleteConfirm(false);
      closeResultsPanel();
    },
  });

  useEffect(() => {
    if (!blogId || !initialized || !dirty) return;
    const timer = setTimeout(() => {
      saveMutation.mutate();
      setDirty(false);
    }, 1500);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced save on edit
  }, [title, contentBlocks, featuredImage, category, status, blogId, initialized, dirty]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || !contentRef.current || !blogId) {
      setSelectionToolbar(null);
      return;
    }
    const range = sel?.getRangeAt(0);
    const rect = range?.getBoundingClientRect();
    const container = contentRef.current.getBoundingClientRect();
    if (!rect) {
      setSelectionToolbar(null);
      return;
    }
    setSelectionToolbar({
      top: rect.top - container.top - 36,
      left: Math.max(0, rect.left - container.left),
    });
  }, [blogId]);

  const handleFocusSelection = () => {
    const sel = window.getSelection()?.toString().trim();
    if (!sel || !blogId) return;
    setSelectionContext({ blogId, selectedText: sel });
    setSelectionToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    const response = await uploadImage.mutateAsync(file);
    return response.data.data.url;
  };

  const handleFeaturedImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const response = await uploadImage.mutateAsync(file);
    setFeaturedImage(response.data.data.url);
    setDirty(true);
  };

  const markDirty = () => setDirty(true);

  if (isLoading && blogId) {
    return (
      <div className={cn("flex items-center justify-center h-full text-gray-400", className)}>
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        Loading draft…
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col h-full min-h-0 bg-black", className)}>
      <div className="flex items-center justify-between gap-3 px-4 py-2 border-b border-gray-800 shrink-0 bg-gray-950/80">
        <span className="text-xs text-gray-500 flex items-center gap-1 min-w-[4rem]">
          {saveMutation.isPending && (
            <>
              <Loader2 className="w-3 h-3 animate-spin" /> Saving…
            </>
          )}
          {saveMutation.isSuccess && !saveMutation.isPending && !dirty && (
            <span className="text-green-500">Saved</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          {blogId && (
            <Link
              href={`/dashboard/blogs/${blogId}`}
              className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-primary transition-colors"
            >
              Open full editor
              <ExternalLink className="w-3 h-3" aria-hidden="true" />
            </Link>
          )}
          {blogId && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              className="h-7 text-xs border-red-900/60 text-red-400 hover:bg-red-950/40 hover:text-red-300"
            >
              <Trash2 className="w-3 h-3 mr-1" aria-hidden="true" />
              Delete
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
        <div className="px-4 md:px-5 py-4 md:py-5">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
            <div className="xl:col-span-2 space-y-5 min-w-0">
              <div>
                <Label htmlFor="orchestrator-draft-title" className="text-gray-300">
                  Title *
                </Label>
                <Input
                  id="orchestrator-draft-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    markDirty();
                  }}
                  placeholder="Blog title"
                  maxLength={200}
                  className="mt-1 bg-black border-gray-700 text-white"
                />
              </div>

              <div
                ref={contentRef}
                className="relative min-w-0"
                onMouseUp={handleMouseUp}
              >
                <Label htmlFor="orchestrator-draft-content" className="text-gray-300 mb-2 block">
                  Content *
                </Label>
                <div className="min-h-[320px] pb-4">
                  <BlockEditor
                    value={contentBlocks}
                    onChange={(blocks) => {
                      setContentBlocks(blocks);
                      markDirty();
                    }}
                    placeholder="Start writing your blog post..."
                    onUploadImage={handleEditorImageUpload}
                  />
                </div>
                <p className="text-xs text-gray-500">
                  Use + or type / to add blocks. Every image requires a caption.
                </p>
                {selectionToolbar && (
                  <button
                    type="button"
                    onClick={handleFocusSelection}
                    className={cn(
                      "absolute z-10 flex items-center gap-1 px-2 py-1 text-xs rounded-md",
                      "bg-primary text-white shadow-lg hover:bg-primary/90"
                    )}
                    style={{ top: selectionToolbar.top, left: selectionToolbar.left }}
                  >
                    <Sparkles className="w-3 h-3" aria-hidden="true" />
                    Focus AI here
                  </button>
                )}
              </div>
            </div>

            <div className="xl:col-span-1 min-w-0">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 space-y-5 sticky top-0">
                <div>
                  <Label htmlFor="orchestrator-draft-status" className="text-gray-300">
                    Status
                  </Label>
                  <select
                    id="orchestrator-draft-status"
                    value={status}
                    onChange={(e) => {
                      setStatus(e.target.value as BlogStatus);
                      markDirty();
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
                  <Label htmlFor="orchestrator-draft-category" className="text-gray-300">
                    Category
                  </Label>
                  <select
                    id="orchestrator-draft-category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      markDirty();
                    }}
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  >
                    <option value="">No Category</option>
                    {categories
                      ?.filter((cat: { is_active?: boolean }) => cat.is_active)
                      .map((cat: { _id: string; name: string }) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <Label htmlFor="orchestrator-draft-featured" className="text-gray-300">
                    Featured Image
                  </Label>
                  <Input
                    id="orchestrator-draft-featured"
                    type="file"
                    accept="image/*"
                    onChange={handleFeaturedImageUpload}
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                  {featuredImage && (
                    <div className="mt-2 relative w-full aspect-video">
                      <Image
                        src={featuredImage}
                        alt="Featured"
                        fill
                        className="object-cover rounded"
                        unoptimized={featuredImage.includes("localhost")}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate()}
        title="Delete blog post?"
        message="This permanently removes the draft from your workspace. This cannot be undone."
        confirmText={deleteMutation.isPending ? "Deleting…" : "Delete"}
        cancelText="Cancel"
        variant="danger"
        closeOnConfirm={false}
        isConfirming={deleteMutation.isPending}
      />
    </div>
  );
}

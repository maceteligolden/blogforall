"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, ChevronDown, ExternalLink, FileText, Loader2, Send, Sparkles, Trash2 } from "lucide-react";
import { BlockEditor } from "@/components/editor/BlockEditor";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ConfirmModal, Modal } from "@/components/ui/modal";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { BlogService } from "@/lib/api/services/blog.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useUploadImage } from "@/lib/hooks/use-blog";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import type { OrchestratorArtifact } from "@/lib/utils/orchestrator-artifacts";
import type { ContentBlock } from "@/lib/types/blog";
import { blocksToHtml } from "@/lib/utils/content-blocks";
import { deriveExcerptFromContent } from "@/lib/utils/blog-excerpt";
import { htmlToBlocks } from "@/lib/utils/html-to-blocks";
import { cn } from "@/lib/utils/cn";

function readEditorSelection(root?: HTMLElement | null): { text: string; rect: DOMRect | null } {
  const readField = (field: HTMLTextAreaElement | HTMLInputElement) => {
    const start = field.selectionStart ?? 0;
    const end = field.selectionEnd ?? 0;
    if (start === end) return null;
    const text = field.value.slice(Math.min(start, end), Math.max(start, end)).trim();
    if (!text) return null;
    const fieldRect = field.getBoundingClientRect();
    return { text, rect: new DOMRect(fieldRect.left + 12, fieldRect.top + 12, 0, 24) };
  };

  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const fromActive = readField(active);
    if (fromActive) return fromActive;
  }

  if (root) {
    for (const field of root.querySelectorAll("textarea, input")) {
      if (field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement) {
        const fromField = readField(field);
        if (fromField) return fromField;
      }
    }
  }

  const sel = window.getSelection();
  const text = sel?.toString().trim() ?? "";
  if (!text || !sel || sel.rangeCount === 0) return { text: "", rect: null };
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return { text, rect: null };
  return { text, rect };
}

function clearEditorSelection(): void {
  const active = document.activeElement;
  if (active instanceof HTMLTextAreaElement || active instanceof HTMLInputElement) {
    const pos = active.selectionStart ?? 0;
    active.setSelectionRange(pos, pos);
    return;
  }
  window.getSelection()?.removeAllRanges();
}

interface BlogDraftResultEditorProps {
  artifact: OrchestratorArtifact;
  className?: string;
}

type BlogStatus = "draft" | "scheduled" | "published" | "unpublished";

export function BlogDraftResultEditor({ artifact, className }: BlogDraftResultEditorProps) {
  const { setSelectionContext, focusComposer, closeResultsPanel, setActiveDraftBlogId } = useOrchestrator();
  const queryClient = useQueryClient();
  const uploadImage = useUploadImage();
  const editorRef = useRef<HTMLDivElement>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [selectionToolbar, setSelectionToolbar] = useState<{ top: number; left: number } | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionsMenuOpen, setActionsMenuOpen] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const data = artifact.outputData;
  const blogId = typeof data.blog_id === "string" ? data.blog_id : typeof data.id === "string" ? data.id : undefined;

  useEffect(() => {
    if (blogId) setActiveDraftBlogId(blogId);
  }, [blogId, setActiveDraftBlogId]);

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
  const lastSyncedBlogId = useRef<string | undefined>(undefined);
  const lastAppliedUpdatedAtRef = useRef<string | null>(null);
  const lastAppliedContentRef = useRef<string | null>(null);
  const suppressAutoSaveUntilRef = useRef(0);
  const isApplyingFromServerRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);

  const applyBlogResponse = useCallback((response: NonNullable<typeof blogResponse>) => {
    const updatedAt = response.updated_at ?? null;
    const contentSnapshot = response.content ?? "";
    if (
      updatedAt &&
      updatedAt === lastAppliedUpdatedAtRef.current &&
      contentSnapshot === lastAppliedContentRef.current
    ) {
      // #region agent log
      fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "3cad4f" },
        body: JSON.stringify({
          sessionId: "3cad4f",
          runId: "highlight-fix",
          hypothesisId: "H-skip",
          location: "blog-draft-result-editor.tsx:applyBlogResponse",
          message: "skipped duplicate updated_at",
          data: { updatedAt },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      return;
    }
    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "3cad4f" },
      body: JSON.stringify({
        sessionId: "3cad4f",
        runId: "highlight-fix",
        hypothesisId: "H-sync",
        location: "blog-draft-result-editor.tsx:applyBlogResponse",
        message: "applying server blog to editor",
        data: {
          updatedAt,
          prevUpdatedAt: lastAppliedUpdatedAtRef.current,
          hasBlocks: !!(response as { content_blocks?: ContentBlock[] }).content_blocks?.length,
          contentLen: (response.content ?? "").length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    isApplyingFromServerRef.current = true;
    suppressAutoSaveUntilRef.current = Date.now() + 4000;
    lastAppliedUpdatedAtRef.current = updatedAt;
    lastAppliedContentRef.current = contentSnapshot;
    setTitle(response.title ?? "");
    const existingBlocks = (response as { content_blocks?: ContentBlock[] }).content_blocks;
    if (existingBlocks && existingBlocks.length > 0) {
      setContentBlocks(existingBlocks);
    } else {
      setContentBlocks(htmlToBlocks(response.content ?? ""));
    }
    setFeaturedImage(response.featured_image ?? "");
    const rawCategory = (response as { category?: string | { _id?: string } }).category;
    if (typeof rawCategory === "string") {
      setCategory(rawCategory);
    } else if (rawCategory?._id) {
      setCategory(rawCategory._id);
    }
    setStatus((response.status as BlogStatus) ?? "draft");
    setInitialized(true);
    setDirty(false);
    setEditorVersion((v) => v + 1);
    queueMicrotask(() => {
      isApplyingFromServerRef.current = false;
    });
  }, []);

  useEffect(() => {
    if (blogId && blogId !== lastSyncedBlogId.current) {
      lastSyncedBlogId.current = blogId;
      lastAppliedUpdatedAtRef.current = null;
      setInitialized(false);
      setDirty(false);
    }
  }, [blogId]);

  useEffect(() => {
    if (!blogResponse) {
      if (!blogId && !initialized) {
        setTitle(typeof data.title === "string" ? data.title : "");
        const content = typeof data.content === "string" ? data.content : "";
        setContentBlocks(htmlToBlocks(content));
        setInitialized(true);
      }
      return;
    }

    const updatedAt = blogResponse.updated_at ?? "";
    if (!initialized) {
      applyBlogResponse(blogResponse);
      return;
    }
    const contentSnapshot = blogResponse.content ?? "";
    const contentChanged = contentSnapshot !== lastAppliedContentRef.current;
    if (updatedAt && (updatedAt !== lastAppliedUpdatedAtRef.current || contentChanged)) {
      applyBlogResponse(blogResponse);
    }
  }, [blogResponse, blogId, data, initialized, applyBlogResponse]);

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
    onSuccess: (response) => {
      if (!blogId) return;
      const payload = (response as { data?: { data?: NonNullable<typeof blogResponse> } })?.data?.data;
      if (!payload) {
        setDirty(false);
        return;
      }
      lastAppliedUpdatedAtRef.current = payload.updated_at ?? null;
      suppressAutoSaveUntilRef.current = Date.now() + 1500;
      queryClient.setQueryData(QUERY_KEYS.BLOG(blogId), payload);
      setDirty(false);
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

  const flushSave = useCallback(async () => {
    if (!blogId || !initialized) return;
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (dirty || saveMutation.isPending) {
      await saveMutation.mutateAsync();
    }
  }, [blogId, initialized, dirty, saveMutation]);

  const publishMutation = useMutation({
    mutationFn: async () => {
      if (!blogId) throw new Error("No draft to publish");
      if (!title.trim()) throw new Error("Add a title before publishing");
      await flushSave();
      await BlogService.publishBlog(blogId);
    },
    onSuccess: () => {
      setActionError(null);
      setStatus("published");
      setActionsMenuOpen(false);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(blogId!) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message;
      setActionError(msg ?? (e as Error)?.message ?? "Failed to publish");
    },
  });

  const scheduleMutation = useMutation({
    mutationFn: async () => {
      if (!blogId) throw new Error("No draft to schedule");
      if (!title.trim()) throw new Error("Add a title before scheduling");
      if (!scheduleAt) throw new Error("Pick a date and time");
      await flushSave();
      const scheduleDate = new Date(scheduleAt);
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      await BlogService.scheduleBlog(blogId, scheduleDate, timezone);
    },
    onSuccess: () => {
      setActionError(null);
      setStatus("scheduled");
      setShowScheduleModal(false);
      setActionsMenuOpen(false);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(blogId!) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message;
      setActionError(msg ?? (e as Error)?.message ?? "Failed to schedule");
    },
  });

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      if (!blogId) throw new Error("No draft to save");
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      setStatus("draft");
      const html = blocksToHtml(contentBlocks);
      const excerpt = deriveExcerptFromContent(html);
      return BlogService.updateBlog(blogId, {
        title,
        excerpt,
        content: "",
        status: "draft",
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
    onSuccess: (response) => {
      setActionError(null);
      setActionsMenuOpen(false);
      setDirty(false);
      const payload = (response as { data?: { data?: NonNullable<typeof blogResponse> } })?.data?.data;
      if (payload && blogId) {
        queryClient.setQueryData(QUERY_KEYS.BLOG(blogId), payload);
      }
    },
    onError: (e: unknown) => {
      const msg = (e as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message;
      setActionError(msg ?? (e as Error)?.message ?? "Failed to save draft");
    },
  });

  const actionsBusy =
    publishMutation.isPending || scheduleMutation.isPending || saveDraftMutation.isPending || saveMutation.isPending;

  useEffect(() => {
    if (!actionsMenuOpen) return;
    const close = (e: MouseEvent) => {
      if (actionsMenuRef.current && !actionsMenuRef.current.contains(e.target as Node)) {
        setActionsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [actionsMenuOpen]);

  useEffect(() => {
    if (!blogId || !initialized || !dirty) return;
    if (isApplyingFromServerRef.current) return;
    if (Date.now() < suppressAutoSaveUntilRef.current) return;
    if (saveMutation.isPending) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveTimerRef.current = null;
      if (isApplyingFromServerRef.current || Date.now() < suppressAutoSaveUntilRef.current) return;
      saveMutation.mutate();
    }, 1500);
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- debounced save on edit
  }, [title, contentBlocks, featuredImage, category, status, blogId, initialized, dirty, saveMutation.isPending]);

  const handleMouseUp = useCallback(() => {
    try {
      const { text, rect } = readEditorSelection(editorRef.current);
      if (!text || !blogId || !rect) {
        setSelectionToolbar(null);
        return;
      }
      const container = editorRef.current?.getBoundingClientRect();
      if (!container) {
        setSelectionToolbar(null);
        return;
      }
      setSelectionToolbar({
        top: rect.top - container.top - 36,
        left: Math.max(0, rect.left - container.left),
      });
    } catch {
      setSelectionToolbar(null);
    }
  }, [blogId]);

  const handleFocusSelection = () => {
    const { text } = readEditorSelection(editorRef.current);
    if (!text || !blogId) return;
    setSelectionContext({
      blogId,
      blogTitle: title.trim() || "Untitled draft",
      selectedText: text,
      referenceType: "highlight",
    });
    setSelectionToolbar(null);
    clearEditorSelection();
    focusComposer();
  };

  const handleEditorImageUpload = async (file: File): Promise<string> => {
    const response = await uploadImage.mutateAsync(file);
    return response.data.data.url;
  };

  const openScheduleModal = () => {
    setActionError(null);
    setActionsMenuOpen(false);
    if (!scheduleAt) {
      const defaultDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      defaultDate.setMinutes(0, 0, 0);
      setScheduleAt(defaultDate.toISOString().slice(0, 16));
    }
    setShowScheduleModal(true);
  };

  const markDirty = () => {
    if (isApplyingFromServerRef.current) return;
    setDirty(true);
  };

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
          {saveMutation.isSuccess && !saveMutation.isPending && !dirty && <span className="text-green-500">Saved</span>}
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
            <div className="relative" ref={actionsMenuRef}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={actionsBusy}
                onClick={() => setActionsMenuOpen((open) => !open)}
                className="h-7 text-xs border-gray-700 text-gray-200 hover:bg-gray-800 hover:text-white"
                aria-expanded={actionsMenuOpen}
                aria-haspopup="menu"
              >
                {actionsBusy ? (
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" aria-hidden="true" />
                ) : (
                  <ChevronDown className="w-3 h-3 mr-1" aria-hidden="true" />
                )}
                Actions
              </Button>
              {actionsMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1 z-20 min-w-[10.5rem] rounded-md border border-gray-800 bg-gray-950 py-1 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionsBusy || status === "published"}
                    onClick={() => publishMutation.mutate()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Send className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Publish
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionsBusy}
                    onClick={openScheduleModal}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <Calendar className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Schedule…
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={actionsBusy || status === "draft"}
                    onClick={() => saveDraftMutation.mutate()}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-gray-200 hover:bg-gray-800 disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    Save as draft
                  </button>
                </div>
              )}
            </div>
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

      {actionError && (
        <p className="px-4 py-2 text-xs text-red-400 border-b border-gray-800 bg-red-950/20 shrink-0">{actionError}</p>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
        <div className="px-4 md:px-5 py-4 md:py-5">
          <div className="max-w-4xl mx-auto space-y-5 min-w-0 relative" ref={editorRef} onMouseUp={handleMouseUp}>
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

            <div className="min-w-0">
              <Label htmlFor="orchestrator-draft-content" className="text-gray-300 mb-2 block">
                Content *
              </Label>
              <div className="min-h-[320px] pb-4">
                <BlockEditor
                  key={`${blogId ?? "draft"}-${editorVersion}`}
                  value={contentBlocks}
                  onChange={(blocks) => {
                    setContentBlocks(blocks);
                    markDirty();
                  }}
                  placeholder="Start writing your blog post..."
                  onUploadImage={handleEditorImageUpload}
                />
              </div>
              <p className="text-xs text-gray-500">Use + or type / to add blocks. Every image requires a caption.</p>
            </div>
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
      </div>

      <Modal
        isOpen={showScheduleModal}
        onClose={() => !scheduleMutation.isPending && setShowScheduleModal(false)}
        title="Schedule post"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={scheduleMutation.isPending}
              onClick={() => setShowScheduleModal(false)}
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
            >
              Cancel
            </Button>
            <Button
              type="button"
              disabled={scheduleMutation.isPending || !scheduleAt}
              onClick={() => scheduleMutation.mutate()}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {scheduleMutation.isPending ? "Scheduling…" : "Schedule"}
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-400 mb-4">Choose when this post should go live.</p>
        <DateTimePicker
          id="orchestrator-schedule-at"
          value={scheduleAt}
          onChange={setScheduleAt}
          min={new Date().toISOString().slice(0, 16)}
          aria-label="Schedule date and time"
          className="w-full"
        />
      </Modal>

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

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, ExternalLink, FileText, Loader2, MessageSquarePlus, Pin, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { useOrchestratorArtifacts } from "@/lib/hooks/use-orchestrator-artifacts";
import { extractUrlFromText, type OrchestratorArtifact } from "@/lib/utils/orchestrator-artifacts";
import type { BlogReviewResult } from "@/lib/api/services/blog-review.service";
import { BlogService } from "@/lib/api/services/blog.service";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { BlogDraftResultEditor } from "@/components/orchestrator/blog-draft-result-editor";

interface OrchestratorArtifactPanelProps {
  className?: string;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

function artifactLabel(tool: string): string {
  switch (tool) {
    case "blogs.generateDraft":
      return "Blog generation";
    case "blogs.createDraft":
      return "Draft created";
    case "blogs.update":
      return "Draft updated";
    case "blogs.review":
      return "Content review";
    case "blogs.list":
    case "blog_list":
      return "Blog list";
    default:
      return tool.replace(/\./g, " · ");
  }
}

function isBlogListTool(tool: string): boolean {
  return tool === "blogs.list" || tool === "blog_list";
}

/** blogs.get may return a ranked candidate list when the topic match is ambiguous. */
function isAmbiguousGetList(artifact: OrchestratorArtifact): boolean {
  if (artifact.tool !== "blogs.get") return false;
  if (artifact.outputData?.ambiguous === true) return true;
  const hasList =
    Array.isArray(artifact.outputData?.items) || Array.isArray(artifact.outputData?.blogs);
  const hasContent = typeof artifact.outputData?.content === "string" && artifact.outputData.content.length > 0;
  return hasList && !hasContent;
}

function isBlogListArtifact(artifact: OrchestratorArtifact): boolean {
  return isBlogListTool(artifact.tool) || isAmbiguousGetList(artifact);
}

type BlogListRow = {
  id?: string;
  title?: string;
  status?: string;
  excerpt?: string;
  slug?: string;
};

function extractBlogListRows(data: Record<string, unknown>): BlogListRow[] {
  const fromBlogs = Array.isArray(data.blogs) ? data.blogs : null;
  const fromItems = Array.isArray(data.items) ? data.items : null;
  const raw = (fromBlogs ?? fromItems ?? []) as Record<string, unknown>[];
  return raw.map((row) => ({
    id: typeof row.id === "string" ? row.id : typeof row._id === "string" ? row._id : undefined,
    title: typeof row.title === "string" ? row.title : "Untitled",
    status: typeof row.status === "string" ? row.status : undefined,
    excerpt: typeof row.excerpt === "string" ? row.excerpt : undefined,
    slug: typeof row.slug === "string" ? row.slug : undefined,
  }));
}

function extractBlogDraftMeta(artifact: OrchestratorArtifact): { blogId: string | null; blogTitle: string } {
  const data = artifact.outputData;
  const blogId = typeof data.blog_id === "string" ? data.blog_id : typeof data.id === "string" ? data.id : null;
  const blogTitle = typeof data.title === "string" && data.title.trim() ? data.title : "Untitled draft";
  return { blogId, blogTitle };
}

function BlogReviewArtifact({ artifact }: { artifact: OrchestratorArtifact }) {
  const data = artifact.outputData;
  const title = typeof data.title === "string" ? data.title : "Blog review";
  const score = typeof data.overall_score === "number" ? data.overall_score : undefined;
  const summary = typeof data.summary === "string" ? data.summary : undefined;
  const suggestions = Array.isArray(data.suggestions) ? data.suggestions : [];

  // Review runner scores 0–100 (not 0–10).
  const scoreColor =
    score === undefined
      ? "text-gray-400"
      : score >= 80
        ? "text-green-400"
        : score >= 60
          ? "text-yellow-400"
          : "text-red-400";

  return (
    <Card className="bg-gray-900 border-gray-800 p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-white truncate">{title}</h3>
        {score !== undefined && <span className={cn("text-lg font-bold shrink-0", scoreColor)}>{score}/100</span>}
      </div>
      {summary && <p className="text-xs text-gray-400">{summary}</p>}
      {suggestions.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Suggestions ({suggestions.length})
          </p>
          {(suggestions as BlogReviewResult["suggestions"]).map((s, i) => (
            <div key={s.id ?? i} className="text-xs border-l-2 border-gray-700 pl-2">
              <span className="text-gray-300">{s.suggestion}</span>
              {s.explanation && <p className="text-gray-500 mt-0.5">{s.explanation}</p>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function GenericArtifact({ artifact }: { artifact: OrchestratorArtifact }) {
  const url = extractUrlFromText(artifact.summary ?? "");
  return (
    <Card className="bg-gray-900 border-gray-800 p-4 space-y-2">
      <p className="text-sm font-medium text-white">{artifactLabel(artifact.tool)}</p>
      {artifact.summary && <p className="text-xs text-gray-400 whitespace-pre-wrap">{artifact.summary}</p>}
      {url && (
        <Link
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          Open link
          <ExternalLink className="w-3 h-3" aria-hidden="true" />
        </Link>
      )}
    </Card>
  );
}

function WritingDraftEmptyState({ generating }: { generating: boolean }) {
  return (
    <div className="flex-1 flex flex-col p-6 gap-4 min-h-0">
      <div className="space-y-2">
        <div className="h-8 rounded-md bg-gray-800/80 animate-pulse" />
        <div className="h-4 w-2/3 rounded bg-gray-800/60" />
      </div>
      <div className="flex-1 rounded-lg border border-dashed border-gray-800 bg-gray-900/40 flex flex-col items-center justify-center p-8 text-center min-h-[12rem]">
        {generating ? (
          <>
            <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-300">Generating your draft…</p>
            <p className="text-xs text-gray-500 mt-1">Content will appear here as the AI writes.</p>
          </>
        ) : (
          <>
            <FileText className="w-8 h-8 text-gray-600 mb-3" aria-hidden="true" />
            <p className="text-sm text-gray-300">No draft yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs">
              Ask the AI to generate a draft or paste content. Your post will show here as it&apos;s created.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function BlogListArtifact({ artifact }: { artifact: OrchestratorArtifact }) {
  const {
    setSelectionContext,
    focusComposer,
    setSelectedArtifactId,
    mergeLiveArtifacts,
    openResultsPanel,
    setActiveDraftBlogId,
  } = useOrchestrator();
  const { artifacts } = useOrchestratorArtifacts();
  const rows = extractBlogListRows(artifact.outputData);
  const total =
    typeof artifact.outputData.total === "number"
      ? artifact.outputData.total
      : typeof (artifact.outputData.pagination as { total?: number } | undefined)?.total === "number"
        ? (artifact.outputData.pagination as { total: number }).total
        : rows.length;
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  const filtered = rows.filter((row) => {
    if (statusFilter !== "all" && row.status !== statusFilter) return false;
    if (!query.trim()) return true;
    return (row.title || "").toLowerCase().includes(query.toLowerCase());
  });

  const openRow = async (row: BlogListRow) => {
    if (!row.id) return;
    setOpenError(null);
    const existing = artifacts.find(
      (a) =>
        (a.tool === "blogs.get" ||
          a.tool === "blogs.generateDraft" ||
          a.tool === "blogs.createDraft" ||
          a.tool === "blogs.update") &&
        (a.outputData.blog_id === row.id || a.outputData.id === row.id) &&
        typeof a.outputData.content === "string" &&
        a.outputData.content.length > 0
    );
    if (existing) {
      setSelectedArtifactId(existing.id);
      setActiveDraftBlogId(row.id);
      return;
    }

    setOpeningId(row.id);
    try {
      const res = await BlogService.getBlogById(row.id);
      const blog = (res.data?.data ?? res.data) as Record<string, unknown> | undefined;
      if (!blog || typeof blog !== "object") {
        throw new Error("Blog payload missing");
      }
      const content = typeof blog.content === "string" ? blog.content : "";
      const liveId = `live-${Date.now()}-list-click`;
      mergeLiveArtifacts([
        {
          id: liveId,
          tool: "blogs.get",
          summary: `Blog '${typeof blog.title === "string" ? blog.title : row.title || "Untitled"}' opened from list.`,
          outputData: {
            id: row.id,
            blog_id: row.id,
            title: typeof blog.title === "string" ? blog.title : row.title,
            slug: typeof blog.slug === "string" ? blog.slug : row.slug,
            status: typeof blog.status === "string" ? blog.status : row.status,
            excerpt: typeof blog.excerpt === "string" ? blog.excerpt : row.excerpt,
            content,
            content_html: content,
            created_at: blog.created_at,
            updated_at: blog.updated_at,
            meta: blog.meta,
            resolution: "list_click",
          },
        },
      ]);
      setActiveDraftBlogId(row.id);
      openResultsPanel(liveId);
    } catch {
      setOpenError("Couldn't open that post. Try again or ask in chat.");
      setSelectionContext({
        blogId: row.id,
        blogTitle: row.title || "Untitled",
        referenceType: "blog",
      });
      focusComposer();
    } finally {
      setOpeningId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 p-4 min-h-0 h-full">
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">Posts ({total})</p>
        {artifact.summary && <p className="text-xs text-gray-400">{artifact.summary}</p>}
        {openError && <p className="text-xs text-red-400">{openError}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search titles…"
          className="bg-black border-gray-700 text-white text-sm"
        />
        <div className="flex flex-wrap gap-1.5">
          {["all", "draft", "published", "scheduled", "unpublished"].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={cn(
                "rounded-md px-2 py-1 text-[11px] border transition-colors",
                statusFilter === s
                  ? "border-primary/60 bg-primary/15 text-primary"
                  : "border-gray-800 text-gray-400 hover:border-gray-700"
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-500 py-6 text-center">No posts match these filters.</p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.id || row.title}
              className="flex items-start justify-between gap-2 rounded-md border border-gray-800 bg-gray-950/60 px-3 py-2"
            >
              <button
                type="button"
                onClick={() => void openRow(row)}
                disabled={openingId === row.id}
                className="min-w-0 text-left flex-1 disabled:opacity-60"
              >
                <p className="text-sm text-white truncate flex items-center gap-1.5">
                  {openingId === row.id && <Loader2 className="w-3 h-3 animate-spin shrink-0" aria-hidden="true" />}
                  {row.title}
                </p>
                <p className="text-[11px] text-gray-500 mt-0.5">
                  {row.status || "unknown"}
                  {row.excerpt ? ` · ${row.excerpt.slice(0, 80)}` : ""}
                </p>
              </button>
              {row.id && (
                <Link
                  href={`/dashboard/blogs/${row.id}`}
                  className="shrink-0 inline-flex items-center gap-1 text-[11px] text-primary hover:underline pt-0.5"
                >
                  Open
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </Link>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function ArtifactContent({ artifact }: { artifact: OrchestratorArtifact }) {
  if (isBlogListArtifact(artifact)) {
    return <BlogListArtifact artifact={artifact} />;
  }

  switch (artifact.tool) {
    case "blogs.generateDraft":
    case "blogs.createDraft":
    case "blogs.update":
    case "blogs.get":
      return <BlogDraftResultEditor artifact={artifact} className="h-full min-h-0" />;
    case "blogs.review":
      return <BlogReviewArtifact artifact={artifact} />;
    case "blogs.list":
    case "blog_list":
      return <BlogListArtifact artifact={artifact} />;
    default:
      return <GenericArtifact artifact={artifact} />;
  }
}

export function OrchestratorArtifactPanel({
  className,
  mobileOpen = false,
  onMobileClose,
}: OrchestratorArtifactPanelProps) {
  const {
    threadId,
    selectedArtifactId,
    setSelectedArtifactId,
    closeResultsPanel,
    isWritingPinned,
    draftGenerating,
    selectionContext,
    setSelectionContext,
    focusComposer,
  } = useOrchestrator();
  const { artifacts } = useOrchestratorArtifacts();
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    if (artifacts.length === 0) {
      setSelectedIndex(null);
      return;
    }
    if (selectedArtifactId) {
      const idx = artifacts.findIndex((a) => a.id === selectedArtifactId);
      if (idx >= 0) {
        setSelectedIndex(idx);
        return;
      }
      // Live id replaced after persist/merge — jump to newest artifact (e.g. review)
      // instead of snapping back to an older get/list.
      const last = artifacts.length - 1;
      setSelectedIndex(last);
      const resolvedId = artifacts[last]?.id;
      if (resolvedId && resolvedId !== selectedArtifactId) {
        setSelectedArtifactId(resolvedId);
      }
      return;
    }
    setSelectedIndex((prev) => {
      if (prev === null || prev >= artifacts.length) return artifacts.length - 1;
      return prev;
    });
  }, [artifacts, threadId, selectedArtifactId, setSelectedArtifactId]);

  const activeArtifact = selectedIndex !== null && artifacts[selectedIndex] ? artifacts[selectedIndex] : null;

  const isBlogDraft =
    !!activeArtifact &&
    !isAmbiguousGetList(activeArtifact) &&
    (activeArtifact.tool === "blogs.generateDraft" ||
      activeArtifact.tool === "blogs.createDraft" ||
      activeArtifact.tool === "blogs.update" ||
      activeArtifact.tool === "blogs.get");
  const isBlogList = activeArtifact ? isBlogListArtifact(activeArtifact) : false;

  const activeBlogMeta = activeArtifact && isBlogDraft ? extractBlogDraftMeta(activeArtifact) : null;

  const handleReferenceInChat = () => {
    if (!activeBlogMeta?.blogId) return;
    setSelectionContext({
      blogId: activeBlogMeta.blogId,
      blogTitle: activeBlogMeta.blogTitle,
      referenceType: "blog",
    });
    focusComposer();
  };

  const isArtifactReferenced = (artifact: OrchestratorArtifact) => {
    if (!selectionContext) return false;
    const { blogId } = extractBlogDraftMeta(artifact);
    return blogId !== null && blogId === selectionContext.blogId;
  };

  const handleClose = () => {
    closeResultsPanel();
    onMobileClose?.();
  };

  const showWritingEmpty = isWritingPinned && artifacts.length === 0;

  return (
    <>
      {mobileOpen && (artifacts.length > 0 || isWritingPinned) && !isWritingPinned && (
        <button
          type="button"
          aria-label="Close results panel"
          className="fixed inset-0 z-30 bg-black/60 lg:hidden"
          onClick={handleClose}
        />
      )}
      <aside
        className={cn(
          "flex flex-col bg-black border-gray-800 overflow-hidden",
          "fixed lg:relative inset-y-0 right-0 z-40 lg:z-auto",
          "top-16 lg:top-0 h-[calc(100vh-4rem)] lg:h-full w-full sm:max-w-md lg:max-w-none lg:w-full",
          "transform transition-transform duration-200 ease-out lg:transform-none",
          mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0",
          !mobileOpen && "hidden lg:flex",
          className
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0 bg-gray-950">
          <div className="flex items-center gap-2 min-w-0">
            <Sparkles className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold truncate">
              {isWritingPinned || isBlogDraft ? "Blog draft" : isBlogList ? "Blog list" : "Results"}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {activeBlogMeta?.blogId && (
              <button
                type="button"
                onClick={handleReferenceInChat}
                className={cn(
                  "hidden sm:inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded border transition-colors",
                  selectionContext?.blogId === activeBlogMeta.blogId && selectionContext.referenceType === "blog"
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900"
                )}
                title="Reference this draft in chat"
              >
                <MessageSquarePlus className="w-3 h-3" aria-hidden="true" />
                Reference in chat
              </button>
            )}
            {!isWritingPinned && (
              <button
                type="button"
                onClick={handleClose}
                className="p-1 text-gray-400 hover:text-white rounded hover:bg-gray-800"
                aria-label="Close results panel"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {artifacts.length > 1 && (
          <div className="border-b border-gray-800 shrink-0 bg-gray-950/60">
            <button
              type="button"
              onClick={() => setTimelineOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left hover:bg-gray-900/50 transition-colors"
              aria-expanded={timelineOpen}
              aria-controls="blog-draft-timeline"
            >
              <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">
                Draft timeline · {artifacts.length} steps
              </span>
              <ChevronDown
                className={cn(
                  "w-3.5 h-3.5 text-gray-500 transition-transform shrink-0",
                  timelineOpen && "rotate-180"
                )}
                aria-hidden="true"
              />
            </button>
            {timelineOpen && (
              <div id="blog-draft-timeline" className="flex flex-wrap gap-1.5 px-4 pb-3">
                {artifacts.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setSelectedIndex(i);
                      setSelectedArtifactId(a.id);
                    }}
                    className={cn(
                      "inline-flex items-center gap-0.5 text-[10px] px-2 py-1 rounded border transition-colors truncate max-w-full",
                      selectedIndex === i
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-gray-800 text-gray-400 hover:text-white hover:bg-gray-900",
                      isArtifactReferenced(a) && "ring-1 ring-primary/40"
                    )}
                  >
                    {isArtifactReferenced(a) && <Pin className="w-2.5 h-2.5 shrink-0" aria-hidden="true" />}
                    <span className="text-gray-600 mr-0.5">{i + 1}.</span>
                    {artifactLabel(a.tool)}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-hidden flex flex-col relative">
          {showWritingEmpty ? (
            <WritingDraftEmptyState generating={draftGenerating} />
          ) : activeArtifact ? (
            isBlogDraft ? (
              <ArtifactContent artifact={activeArtifact} />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-4 [scrollbar-gutter:stable]">
                <ArtifactContent artifact={activeArtifact} />
              </div>
            )
          ) : isWritingPinned ? (
            <WritingDraftEmptyState generating={draftGenerating} />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                <p className="text-sm text-gray-400">
                  {artifacts.length === 0 ? "Loading results…" : "Select a result to view."}
                </p>
              </div>
            </div>
          )}
          {draftGenerating && activeArtifact && isBlogDraft && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none z-10">
              <Loader2 className="w-8 h-8 text-primary animate-spin" aria-hidden="true" />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

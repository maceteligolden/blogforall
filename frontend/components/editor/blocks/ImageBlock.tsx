"use client";

import type { ContentBlock } from "@/lib/types/blog";

interface ImageBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  selected?: boolean;
  /** Placeholder shown when no url yet (e.g. "Uploading..." or "Add image") */
  uploadStatus?: "idle" | "uploading" | "failed";
  onRetry?: () => void;
}

export function ImageBlock({ block, onChange, onKeyDown, uploadStatus = "idle", onRetry }: ImageBlockProps) {
  const url = block.data?.url ?? "";
  const caption = block.data?.caption ?? "";
  const isBlob = url.startsWith("blob:");

  return (
    <figure className="group/block my-4" data-block-type="image">
      <div className="relative">
        {url ? (
          <img
            src={url}
            alt={caption || "Image"}
            className="max-h-[400px] w-auto rounded-lg object-contain"
          />
        ) : (
          <div className="flex min-h-[120px] items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-900/50 text-gray-500">
            {uploadStatus === "uploading" ? "Uploading..." : "Add image"}
          </div>
        )}
        {uploadStatus === "failed" && (
          <div className="mt-2 text-sm text-red-400">
            Upload failed.{" "}
            {onRetry && (
              <button type="button" onClick={onRetry} className="underline">
                Retry
              </button>
            )}
          </div>
        )}
      </div>
      <figcaption className="mt-2">
        <input
          type="text"
          value={caption}
          onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="Add a caption (required)"
          className="w-full border-0 bg-transparent px-0 py-1 text-center text-sm italic text-gray-400 placeholder:text-gray-500 focus:outline-none focus:ring-0"
        />
      </figcaption>
    </figure>
  );
}

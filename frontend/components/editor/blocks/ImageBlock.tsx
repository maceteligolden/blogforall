"use client";

import { useRef } from "react";
import type { ContentBlock } from "@/lib/types/blog";

interface ImageBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  selected?: boolean;
  uploadStatus?: "idle" | "uploading" | "failed";
  onFileSelect?: (file: File) => void;
  onRetry?: () => void;
}

export function ImageBlock({ block, onChange, onKeyDown, uploadStatus = "idle", onFileSelect, onRetry }: ImageBlockProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const url = block.data?.url ?? "";
  const caption = block.data?.caption ?? "";
  const captionEmpty = typeof caption !== "string" || caption.trim() === "";
  const showCaptionError = url && captionEmpty;

  const handleClick = () => {
    if (!url && onFileSelect) inputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onFileSelect) onFileSelect(file);
    e.target.value = "";
  };

  return (
    <figure className="group/block my-4" data-block-type="image">
      <div className="relative">
        {url ? (
          <img
            src={url as string}
            alt={caption as string || "Image"}
            className="max-h-[400px] w-auto rounded-lg object-contain"
          />
        ) : (
          <button
            type="button"
            onClick={handleClick}
            disabled={!onFileSelect || uploadStatus === "uploading"}
            className="flex min-h-[120px] w-full cursor-pointer items-center justify-center rounded-lg border border-dashed border-gray-600 bg-gray-900/50 text-gray-500 hover:border-gray-500 hover:text-gray-400 disabled:cursor-wait"
          >
            {uploadStatus === "uploading" ? "Uploading..." : "Click to add image"}
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={handleFileChange}
        />
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
          value={caption as string}
          onChange={(e) => onChange({ ...block.data, caption: e.target.value })}
          onKeyDown={onKeyDown}
          placeholder="Add a caption (required)"
          className={`w-full border-0 bg-transparent px-0 py-1 text-center text-sm italic text-gray-400 placeholder:text-gray-500 focus:outline-none focus:ring-0 ${showCaptionError ? "placeholder:text-red-400" : ""}`}
          aria-invalid={showCaptionError}
          aria-describedby={showCaptionError ? "caption-required" : undefined}
        />
        {showCaptionError && (
          <p id="caption-required" className="mt-1 text-center text-xs text-red-400">
            Caption required
          </p>
        )}
      </figcaption>
    </figure>
  );
}

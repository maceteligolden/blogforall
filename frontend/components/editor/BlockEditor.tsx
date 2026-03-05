"use client";

import { useCallback, useRef, useState } from "react";
import type { ContentBlock, ContentBlockType } from "@/lib/types/blog";
import {
  ParagraphBlock,
  HeadingBlock,
  ListBlock,
  BlockquoteBlock,
  CodeBlock,
  ImageBlock,
} from "./blocks";
import { BlockMenu } from "./BlockMenu";

function generateBlockId(): string {
  return `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

const DEFAULT_BLOCK: ContentBlock = {
  id: generateBlockId(),
  type: "paragraph",
  data: { text: "" },
};

interface BlockEditorProps {
  value: ContentBlock[];
  onChange: (blocks: ContentBlock[]) => void;
  placeholder?: string;
  className?: string;
  /** When provided, image blocks can upload files; returns final URL on success */
  onUploadImage?: (file: File) => Promise<string>;
}

export function BlockEditor({ value, onChange, placeholder, className = "", onUploadImage }: BlockEditorProps) {
  const blocks = (Array.isArray(value) && value.length > 0) ? value : [DEFAULT_BLOCK];
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [menuOpenAt, setMenuOpenAt] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState<Record<string, "uploading" | "failed">>({});
  const pendingFiles = useRef<Record<string, File>>({});

  const updateBlock = useCallback(
    (index: number, updates: Partial<ContentBlock>) => {
      const next = [...blocks];
      next[index] = { ...next[index], ...updates };
      onChange(next);
    },
    [blocks, onChange]
  );

  const updateBlockData = useCallback(
    (index: number, data: ContentBlock["data"]) => {
      updateBlock(index, { data: { ...blocks[index].data, ...data } });
    },
    [blocks, updateBlock]
  );

  const insertBlockAfter = useCallback(
    (index: number, type: ContentBlockType = "paragraph", data: ContentBlock["data"] = {}) => {
      const newBlock: ContentBlock = {
        id: generateBlockId(),
        type,
        data: type === "heading" ? { ...data, level: data.level ?? 1 } : type === "list" ? { ...data, items: data.items ?? [""], listType: data.listType ?? "bullet" } : data,
      };
      const next = [...blocks];
      next.splice(index + 1, 0, newBlock);
      onChange(next);
      setTimeout(() => {
        const el = blockRefs.current[index + 1];
        const input = el?.querySelector("textarea, input");
        if (input instanceof HTMLElement) input.focus();
      }, 0);
    },
    [blocks, onChange]
  );

  const deleteBlock = useCallback(
    (index: number) => {
      if (blocks.length <= 1) return;
      const next = blocks.filter((_, i) => i !== index);
      onChange(next);
      const prevIndex = Math.max(0, index - 1);
      setTimeout(() => {
        const el = blockRefs.current[prevIndex];
        const input = el?.querySelector("textarea, input");
        if (input instanceof HTMLElement) input.focus();
      }, 0);
    },
    [blocks, onChange]
  );

  const handleMenuSelect = useCallback(
    (type: ContentBlockType, extra?: { level?: number; listType?: "bullet" | "ordered" }) => {
      if (menuOpenAt === null) return;
      const data: ContentBlock["data"] =
        type === "heading" ? { level: extra?.level ?? 1, text: "" } : type === "list" ? { items: [""], listType: extra?.listType ?? "bullet" } : {};
      insertBlockAfter(menuOpenAt, type, data);
      setMenuOpenAt(null);
    },
    [menuOpenAt, insertBlockAfter]
  );

  const createKeyDownHandler = useCallback(
    (index: number) => (e: React.KeyboardEvent) => {
      if (e.key === "/" && !e.ctrlKey && !e.metaKey) {
        const block = blocks[index];
        const text = (block.data?.text ?? "") as string;
        if (block.type === "paragraph" && text.endsWith("/")) {
          e.preventDefault();
          updateBlockData(index, { text: text.slice(0, -1) });
          setMenuOpenAt(index);
        }
      }
      if (e.key === "Enter" && !e.shiftKey) {
        const block = blocks[index];
        if (block.type === "paragraph" || block.type === "heading" || block.type === "blockquote" || block.type === "code") {
          e.preventDefault();
          insertBlockAfter(index, "paragraph");
        }
      }
      if (e.key === "Backspace") {
        const block = blocks[index];
        const text = block.data?.text ?? "";
        const isEmpty = typeof text === "string" && text.trim() === "";
        if (block.type === "list") {
          const items = block.data?.items ?? [];
          if (Array.isArray(items) && items.length === 1 && !items[0]?.trim()) {
            e.preventDefault();
            deleteBlock(index);
          }
        } else if (isEmpty) {
          e.preventDefault();
          deleteBlock(index);
        }
      }
      if (e.key === "Escape") {
        setMenuOpenAt(null);
      }
    },
    [blocks, insertBlockAfter, deleteBlock, updateBlockData]
  );

  const openMenuAfter = useCallback((index: number) => {
    setMenuOpenAt(index);
  }, []);

  const handleImageUpload = useCallback(
    async (index: number, file: File) => {
      if (!onUploadImage) return;
      const block = blocks[index];
      if (block?.type !== "image") return;
      const blobUrl = URL.createObjectURL(file);
      updateBlockData(index, { url: blobUrl });
      setUploadStatus((s) => ({ ...s, [block.id]: "uploading" }));
      pendingFiles.current[block.id] = file;
      try {
        const url = await onUploadImage(file);
        updateBlockData(index, { url });
        setUploadStatus((s) => {
          const next = { ...s };
          delete next[block.id];
          return next;
        });
        delete pendingFiles.current[block.id];
        URL.revokeObjectURL(blobUrl);
      } catch {
        setUploadStatus((s) => ({ ...s, [block.id]: "failed" }));
      }
    },
    [blocks, onUploadImage, updateBlockData]
  );

  const handleImageRetry = useCallback(
    (index: number) => {
      const block = blocks[index];
      const file = block ? pendingFiles.current[block.id] : undefined;
      if (file) handleImageUpload(index, file);
    },
    [blocks, handleImageUpload]
  );

  return (
    <div className={`relative space-y-1 ${className}`}>
      {menuOpenAt !== null && (
        <div className="mb-2">
          <BlockMenu
            onSelect={handleMenuSelect}
            onClose={() => setMenuOpenAt(null)}
          />
        </div>
      )}
      {(blocks ?? []).map((block, index) => (
        <div
          key={block.id}
          ref={(el) => { blockRefs.current[index] = el; }}
          className="group relative flex gap-1"
        >
          <button
            type="button"
            onClick={() => openMenuAfter(index)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-500 opacity-0 hover:bg-gray-800 hover:text-white group-hover:opacity-100"
            aria-label="Add block"
          >
            +
          </button>
          <div className="min-w-0 flex-1">
          {block.type === "paragraph" && (
            <ParagraphBlock
              block={block}
              onChange={(data) => updateBlockData(index, data)}
              onKeyDown={createKeyDownHandler(index)}
              placeholder={index === 0 ? placeholder : undefined}
            />
          )}
          {block.type === "heading" && (
            <HeadingBlock
              block={block}
              onChange={(data) => updateBlockData(index, data)}
              onKeyDown={createKeyDownHandler(index)}
            />
          )}
          {block.type === "list" && (
            <ListBlock
              block={block}
              onChange={(data) => updateBlockData(index, data)}
              onKeyDown={createKeyDownHandler(index)}
            />
          )}
          {block.type === "blockquote" && (
            <BlockquoteBlock
              block={block}
              onChange={(data) => updateBlockData(index, data)}
              onKeyDown={createKeyDownHandler(index)}
            />
          )}
          {block.type === "code" && (
            <CodeBlock
              block={block}
              onChange={(data) => updateBlockData(index, data)}
              onKeyDown={createKeyDownHandler(index)}
            />
          )}
          {block.type === "image" && (
            <ImageBlock
              block={block}
              onChange={(data) => updateBlockData(index, data)}
              onKeyDown={createKeyDownHandler(index)}
              uploadStatus={uploadStatus[block.id]}
              onFileSelect={onUploadImage ? (file) => handleImageUpload(index, file) : undefined}
              onRetry={uploadStatus[block.id] === "failed" ? () => handleImageRetry(index) : undefined}
            />
          )}
          </div>
        </div>
      ))}
      <button
        type="button"
        onClick={() => openMenuAfter(blocks.length - 1)}
        className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-800 hover:text-white"
        aria-label="Add block"
      >
        +
      </button>
    </div>
  );
}

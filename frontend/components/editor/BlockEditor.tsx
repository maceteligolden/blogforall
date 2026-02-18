"use client";

import { useCallback, useRef } from "react";
import type { ContentBlock, ContentBlockType } from "@/lib/types/blog";
import {
  ParagraphBlock,
  HeadingBlock,
  ListBlock,
  BlockquoteBlock,
  CodeBlock,
  ImageBlock,
} from "./blocks";

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
}

export function BlockEditor({ value, onChange, placeholder, className = "" }: BlockEditorProps) {
  const blocks = value.length > 0 ? value : [DEFAULT_BLOCK];
  const blockRefs = useRef<(HTMLDivElement | null)[]>([]);

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

  const createKeyDownHandler = useCallback(
    (index: number) => (e: React.KeyboardEvent) => {
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
          if (items.length === 1 && !items[0]?.trim()) {
            e.preventDefault();
            deleteBlock(index);
          }
        } else if (isEmpty) {
          e.preventDefault();
          deleteBlock(index);
        }
      }
    },
    [blocks, insertBlockAfter, deleteBlock]
  );

  const appendBlock = useCallback(() => {
    insertBlockAfter(blocks.length - 1, "paragraph");
  }, [blocks.length, insertBlockAfter]);

  return (
    <div className={`space-y-1 ${className}`}>
      {blocks.map((block, index) => (
        <div
          key={block.id}
          ref={(el) => { blockRefs.current[index] = el; }}
          className="relative"
        >
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
            />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={appendBlock}
        className="flex h-8 w-8 items-center justify-center rounded text-gray-500 hover:bg-gray-800 hover:text-white"
        aria-label="Add block"
      >
        +
      </button>
    </div>
  );
}

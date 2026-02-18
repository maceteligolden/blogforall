"use client";

import { useCallback } from "react";
import type { ContentBlock } from "@/lib/types/blog";

interface HeadingBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  selected?: boolean;
}

const levelToTag = { 1: "text-3xl", 2: "text-2xl", 3: "text-xl" } as const;

export function HeadingBlock({ block, onChange, onKeyDown, placeholder = "Heading", selected }: HeadingBlockProps) {
  const text = block.data?.text ?? "";
  const level = Math.min(3, Math.max(1, block.data?.level ?? 1));
  const sizeClass = levelToTag[level as 1 | 2 | 3] ?? "text-2xl";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onChange({ ...block.data, text: e.target.value });
    },
    [block.data, onChange]
  );

  return (
    <div className="group/block relative" data-block-type="heading">
      <input
        type="text"
        value={text}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={`w-full border-0 bg-transparent px-0 py-1 font-bold text-white placeholder:text-gray-500 focus:outline-none focus:ring-0 ${sizeClass}`}
      />
    </div>
  );
}

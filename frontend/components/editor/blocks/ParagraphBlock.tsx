"use client";

import { useCallback } from "react";
import type { ContentBlock } from "@/lib/types/blog";

interface ParagraphBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  selected?: boolean;
}

export function ParagraphBlock({ block, onChange, onKeyDown, placeholder = "Write something...", selected }: ParagraphBlockProps) {
  const text = block.data?.text ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...block.data, text: e.target.value });
    },
    [block.data, onChange]
  );

  return (
    <div className="group/block relative" data-block-type="paragraph">
      <textarea
        value={text}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[1.5em] resize-none border-0 bg-transparent px-0 py-1 text-white placeholder:text-gray-500 focus:outline-none focus:ring-0"
        rows={1}
        style={{ minHeight: "1.5em" }}
      />
    </div>
  );
}

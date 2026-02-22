"use client";

import { useCallback } from "react";
import type { ContentBlock } from "@/lib/types/blog";

interface BlockquoteBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  selected?: boolean;
}

export function BlockquoteBlock({ block, onChange, onKeyDown, placeholder = "Quote", selected }: BlockquoteBlockProps) {
  const text = block.data?.text ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...block.data, text: e.target.value });
    },
    [block.data, onChange]
  );

  return (
    <div className="group/block relative border-l-4 border-gray-600 pl-4" data-block-type="blockquote">
      <textarea
        value={text as string}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[1.5em] resize-none border-0 bg-transparent px-0 py-1 text-gray-300 italic placeholder:text-gray-500 focus:outline-none focus:ring-0"
        rows={1}
      />
    </div>
  );
}

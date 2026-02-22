"use client";

import { useCallback } from "react";
import type { ContentBlock } from "@/lib/types/blog";

interface CodeBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  selected?: boolean;
}

export function CodeBlock({ block, onChange, onKeyDown, placeholder = "Code", selected }: CodeBlockProps) {
  const text = block.data?.text ?? "";

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...block.data, text: e.target.value });
    },
    [block.data, onChange]
  );

  return (
    <div className="group/block relative" data-block-type="code">
      <pre className="rounded-md bg-gray-900 p-3">
        <textarea
          value={text as string}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full min-h-[80px] resize-y border-0 bg-transparent p-0 font-mono text-sm text-green-400 placeholder:text-gray-500 focus:outline-none focus:ring-0"
          spellCheck={false}
        />
      </pre>
    </div>
  );
}

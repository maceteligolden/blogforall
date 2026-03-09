"use client";

import { useCallback, useEffect, useRef } from "react";
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

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = "0px";
    el.style.height = `${el.scrollHeight}px`;
  };

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange({ ...block.data, text: e.target.value });
      autoResize(e.target);
    },
    [block.data, onChange]
  );

  useEffect(() => {
    if (textareaRef.current) {
      autoResize(textareaRef.current);
    }
  }, [text]);

  return (
    <div className="group/block relative border-l-4 border-gray-600 pl-4" data-block-type="blockquote">
      <textarea
        ref={textareaRef}
        value={text as string}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className="w-full min-h-[1.5em] resize-none border-0 bg-transparent px-0 py-1 text-gray-300 italic placeholder:text-gray-500 focus:outline-none focus:ring-0"
      />
    </div>
  );
}

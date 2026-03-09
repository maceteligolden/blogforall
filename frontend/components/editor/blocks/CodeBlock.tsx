"use client";

import { useCallback, useEffect, useRef } from "react";
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
    <div className="group/block relative" data-block-type="code">
      <pre className="rounded-md bg-gray-900 p-3">
        <textarea
          ref={textareaRef}
          value={text as string}
          onChange={handleChange}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full min-h-[80px] resize-none border-0 bg-transparent p-0 font-mono text-sm text-green-400 placeholder:text-gray-500 focus:outline-none focus:ring-0"
          spellCheck={false}
        />
      </pre>
    </div>
  );
}

"use client";

import { useCallback } from "react";
import type { ContentBlockType } from "@/lib/types/blog";
import { Type, Heading1, Heading2, Heading3, List, Image, Quote, Code } from "lucide-react";

const BLOCK_OPTIONS: { type: ContentBlockType; label: string; icon: React.ReactNode }[] = [
  { type: "paragraph", label: "Paragraph", icon: <Type className="h-4 w-4" /> },
  { type: "heading", label: "Heading 1", icon: <Heading1 className="h-4 w-4" /> },
  { type: "heading", label: "Heading 2", icon: <Heading2 className="h-4 w-4" /> },
  { type: "heading", label: "Heading 3", icon: <Heading3 className="h-4 w-4" /> },
  { type: "list", label: "List", icon: <List className="h-4 w-4" /> },
  { type: "image", label: "Image", icon: <Image className="h-4 w-4" /> },
  { type: "blockquote", label: "Quote", icon: <Quote className="h-4 w-4" /> },
  { type: "code", label: "Code", icon: <Code className="h-4 w-4" /> },
];

interface BlockMenuProps {
  onSelect: (type: ContentBlockType, extra?: { level?: number; listType?: "bullet" | "ordered" }) => void;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function BlockMenu({ onSelect, onClose }: BlockMenuProps) {
  const handleSelect = useCallback(
    (type: ContentBlockType, level?: number, listType?: "bullet" | "ordered") => {
      if (type === "heading") {
        onSelect(type, { level: level ?? 1 });
      } else if (type === "list") {
        onSelect(type, { listType: listType ?? "bullet" });
      } else {
        onSelect(type);
      }
      onClose();
    },
    [onSelect, onClose]
  );

  return (
    <div
      className="z-50 min-w-[200px] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
      role="listbox"
    >
      {BLOCK_OPTIONS.map((opt, i) => (
        <button
          key={`${opt.type}-${i}`}
          type="button"
          role="option"
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-white hover:bg-gray-800"
          onClick={() => {
            if (opt.type === "heading") {
              const level = i === 1 ? 1 : i === 2 ? 2 : 3;
              handleSelect(opt.type, level);
            } else if (opt.type === "list") {
              handleSelect(opt.type, undefined, "bullet");
            } else {
              handleSelect(opt.type);
            }
          }}
        >
          {opt.icon}
          <span>{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

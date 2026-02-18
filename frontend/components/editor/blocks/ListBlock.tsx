"use client";

import { useCallback } from "react";
import type { ContentBlock } from "@/lib/types/blog";

interface ListBlockProps {
  block: ContentBlock;
  onChange: (data: ContentBlock["data"]) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  selected?: boolean;
}

export function ListBlock({ block, onChange, onKeyDown }: ListBlockProps) {
  const items = Array.isArray(block.data?.items) ? block.data.items : [""];
  const listType = block.data?.listType === "ordered" ? "ordered" : "bullet";

  const updateItem = useCallback(
    (index: number, value: string) => {
      const next = [...items];
      next[index] = value;
      onChange({ ...block.data, items: next });
    },
    [block.data, items, onChange]
  );

  const addItem = useCallback(() => {
    onChange({ ...block.data, items: [...items, ""] });
  }, [block.data, items, onChange]);

  const Tag = listType === "ordered" ? "ol" : "ul";

  return (
    <div className="group/block relative" data-block-type="list">
      <Tag className={listType === "ordered" ? "list-decimal" : "list-disc"} style={{ paddingLeft: "1.5rem" }}>
        {items.map((item, i) => (
          <li key={i} className="py-0.5">
            <input
              type="text"
              value={item}
              onChange={(e) => updateItem(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  addItem();
                } else {
                  onKeyDown(e);
                }
              }}
              className="w-full border-0 bg-transparent px-0 py-0 text-white placeholder:text-gray-500 focus:outline-none focus:ring-0"
              placeholder="List item"
            />
          </li>
        ))}
      </Tag>
    </div>
  );
}

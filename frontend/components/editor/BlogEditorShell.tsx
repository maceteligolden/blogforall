"use client";

import type { ReactNode } from "react";

interface BlogEditorShellProps {
  titleInput: ReactNode;
  editor: ReactNode;
  sidebar: ReactNode;
  className?: string;
}

/**
 * Medium-like layout for blog create/edit: title, editor (main), sidebar (metadata).
 * Minimal chrome, no heavy borders.
 */
export function BlogEditorShell({ titleInput, editor, sidebar, className = "" }: BlogEditorShellProps) {
  return (
    <div className={`flex flex-col gap-8 lg:flex-row lg:gap-12 ${className}`}>
      <div className="min-w-0 flex-1">
        <div className="mb-6">{titleInput}</div>
        <div className="min-h-[300px]">{editor}</div>
      </div>
      <aside className="w-full shrink-0 space-y-6 lg:w-72">{sidebar}</aside>
    </div>
  );
}

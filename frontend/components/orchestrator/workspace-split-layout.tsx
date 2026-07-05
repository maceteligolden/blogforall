"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import { useResizableSplit } from "@/lib/hooks/use-resizable-split";

interface WorkspaceSplitLayoutProps {
  left: ReactNode;
  right: ReactNode;
  showRight: boolean;
  className?: string;
}

export function WorkspaceSplitLayout({
  left,
  right,
  showRight,
  className,
}: WorkspaceSplitLayoutProps) {
  const {
    containerRef,
    ratio,
    isDragging,
    onSeparatorPointerDown,
    onSeparatorPointerMove,
    onSeparatorPointerUp,
  } = useResizableSplit("orchestrator_workspace_split");

  const leftWidth = showRight ? `${ratio * 100}%` : "100%";
  const rightWidth = `${(1 - ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      className={cn("flex h-full min-h-0 w-full overflow-hidden", className)}
    >
      <div className="min-w-0 h-full shrink-0 flex flex-col" style={{ width: leftWidth }}>
        {left}
      </div>

      {showRight && (
        <>
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize chat and results panels"
            aria-valuenow={Math.round(ratio * 100)}
            tabIndex={0}
            onPointerDown={onSeparatorPointerDown}
            onPointerMove={onSeparatorPointerMove}
            onPointerUp={onSeparatorPointerUp}
            onPointerCancel={onSeparatorPointerUp}
            className={cn(
              "hidden lg:flex w-1.5 shrink-0 cursor-col-resize items-center justify-center",
              "bg-gray-950 border-x border-gray-800/80",
              "hover:bg-gray-900 active:bg-primary/20 transition-colors group",
              isDragging && "bg-primary/20"
            )}
          >
            <div
              className={cn(
                "w-0.5 h-10 rounded-full bg-gray-700 transition-colors",
                "group-hover:bg-gray-500 group-active:bg-primary/70",
                isDragging && "bg-primary/70"
              )}
            />
          </div>

          <div
            className="max-lg:contents min-w-0 h-full shrink-0 lg:flex lg:flex-col lg:overflow-hidden"
            style={{ width: rightWidth }}
          >
            {right}
          </div>
        </>
      )}
    </div>
  );
}

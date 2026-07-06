"use client";

import { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface SidebarTooltipProps {
  label: string;
  children: ReactNode;
  enabled?: boolean;
  className?: string;
}

export function SidebarTooltip({ label, children, enabled = true, className }: SidebarTooltipProps) {
  if (!enabled) {
    return <>{children}</>;
  }

  return (
    <div className={cn("group/tooltip relative flex justify-center", className)}>
      {children}
      <div
        role="tooltip"
        className={cn(
          "pointer-events-none absolute left-full top-1/2 z-[60] ml-2 -translate-y-1/2",
          "whitespace-nowrap rounded-md border border-gray-800 bg-gray-900 px-3 py-2 text-sm text-white shadow-lg",
          "opacity-0 transition-opacity duration-150 group-hover/tooltip:opacity-100"
        )}
      >
        {label}
      </div>
    </div>
  );
}

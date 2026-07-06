"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type {
  OperationalSessionMode,
  OrchestratorSessionMode,
} from "@/lib/types/orchestrator-session.types";

const AUTO_OPTION = {
  id: "auto" as const,
  label: "Auto",
  description: "AI picks the best mode for each message",
};

const OPERATIONAL_MODES: {
  id: OperationalSessionMode;
  label: string;
  description: string;
}[] = [
  { id: "planning", label: "Planning", description: "Outline ideas and strategy" },
  { id: "strategy", label: "Strategy", description: "Themes, clusters, and calendar" },
  { id: "writing", label: "Writing", description: "Draft and edit blog content" },
  { id: "research", label: "Research", description: "Explore and summarize content" },
  { id: "review", label: "Review", description: "Score and improve drafts" },
  { id: "casual", label: "Casual", description: "General workspace chat" },
];

const MODE_LABELS: Record<OperationalSessionMode, string> = {
  planning: "Planning",
  strategy: "Strategy",
  writing: "Writing",
  research: "Research",
  review: "Review",
  casual: "Casual",
};

interface ChatModeSelectorProps {
  value: OrchestratorSessionMode;
  effectiveMode: OperationalSessionMode;
  onChange: (mode: OrchestratorSessionMode) => void;
  disabled?: boolean;
  className?: string;
}

export function ChatModeSelector({
  value,
  effectiveMode,
  onChange,
  disabled = false,
  className,
}: ChatModeSelectorProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const displayLabel =
    value === "auto" ? `Auto · ${MODE_LABELS[effectiveMode]}` : MODE_LABELS[value as OperationalSessionMode] ?? "Auto";

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Chat mode: ${displayLabel}`}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors",
          "text-gray-400 hover:text-gray-200 hover:bg-gray-800/80",
          "disabled:opacity-40 disabled:pointer-events-none",
          open && "bg-gray-800/80 text-gray-200"
        )}
      >
        <span>{displayLabel}</span>
        <ChevronDown
          className={cn("w-3 h-3 opacity-70 transition-transform", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Chat mode"
          className="absolute bottom-full left-0 mb-1.5 z-50 min-w-[11rem] rounded-lg border border-gray-700 bg-gray-900 py-1 shadow-xl"
        >
          <button
            key={AUTO_OPTION.id}
            type="button"
            role="option"
            aria-selected={value === "auto"}
            onClick={() => {
              onChange("auto");
              setOpen(false);
            }}
            className={cn(
              "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
              value === "auto" ? "bg-primary/10 text-primary" : "text-gray-300 hover:bg-gray-800 hover:text-white"
            )}
          >
            <span className="text-xs font-medium">{AUTO_OPTION.label}</span>
            <span className="text-[10px] text-gray-500 leading-tight">{AUTO_OPTION.description}</span>
          </button>
          {OPERATIONAL_MODES.map((mode) => (
            <button
              key={mode.id}
              type="button"
              role="option"
              aria-selected={value === mode.id || (value === "auto" && effectiveMode === mode.id)}
              onClick={() => {
                onChange(mode.id);
                setOpen(false);
              }}
              className={cn(
                "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left transition-colors",
                value === mode.id
                  ? "bg-primary/10 text-primary"
                  : value === "auto" && effectiveMode === mode.id
                    ? "bg-gray-800/60 text-primary/80"
                    : "text-gray-300 hover:bg-gray-800 hover:text-white"
              )}
            >
              <span className="text-xs font-medium">{mode.label}</span>
              <span className="text-[10px] text-gray-500 leading-tight">{mode.description}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

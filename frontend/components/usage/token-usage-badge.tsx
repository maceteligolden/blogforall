"use client";

import { cn } from "@/lib/utils/cn";
import { useTokenUsage } from "@/lib/hooks/use-token-usage";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

interface TokenUsageBadgeProps {
  className?: string;
  compact?: boolean;
}

export function TokenUsageBadge({ className, compact }: TokenUsageBadgeProps) {
  const { data, isLoading, isError } = useTokenUsage();

  if (isLoading || isError || !data || data.unlimited) {
    return null;
  }

  const label = compact
    ? `${formatTokens(data.used)}/${formatTokens(data.allocation)}`
    : `${formatTokens(data.used)} / ${formatTokens(data.allocation)} tokens`;

  const low = data.available <= 0;

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] sm:text-xs font-medium tabular-nums",
        low
          ? "border-red-800/60 bg-red-950/40 text-red-200"
          : "border-gray-700 bg-gray-900/80 text-gray-300",
        className
      )}
      title={`${data.used.toLocaleString()} used of ${data.allocation.toLocaleString()} daily tokens`}
    >
      {label}
    </span>
  );
}

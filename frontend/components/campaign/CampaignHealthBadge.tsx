"use client";

const HEALTH_STYLES: Record<string, string> = {
  on_track: "bg-green-900/30 text-green-400 border-green-800",
  at_risk: "bg-amber-900/30 text-amber-400 border-amber-800",
  underperforming: "bg-orange-900/30 text-orange-400 border-orange-800",
  exceeding: "bg-blue-900/30 text-blue-400 border-blue-800",
  unknown: "bg-gray-800 text-gray-400 border-gray-700",
};

export function CampaignHealthBadge({ status }: { status?: string }) {
  const key = (status ?? "unknown").toLowerCase();
  const label = key.replace(/_/g, " ");
  return (
    <span
      className={`px-2 py-0.5 text-xs rounded capitalize border ${HEALTH_STYLES[key] ?? HEALTH_STYLES.unknown}`}
    >
      {label}
    </span>
  );
}

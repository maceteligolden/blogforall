"use client";

import type { Campaign } from "@/lib/api/services/campaign.service";
import { cn } from "@/lib/utils/cn";

export function campaignRecordId(campaign: Pick<Campaign, "_id"> & { id?: string }): string {
  return campaign._id || campaign.id || "";
}

export function CampaignSelectList({
  campaigns,
  selectedId,
  onSelect,
  loading,
  emptyLabel = "No campaigns yet. Create one first.",
}: {
  campaigns: Campaign[];
  selectedId: string;
  onSelect: (id: string) => void;
  loading?: boolean;
  emptyLabel?: string;
}) {
  if (loading) {
    return <p className="text-sm text-gray-500">Loading campaigns…</p>;
  }
  if (campaigns.length === 0) {
    return <p className="text-sm text-gray-500">{emptyLabel}</p>;
  }
  return (
    <ul className="space-y-2">
      {campaigns.map((campaign) => {
        const id = campaignRecordId(campaign);
        const selected = id === selectedId;
        return (
          <li key={id}>
            <button
              type="button"
              onClick={() => onSelect(id)}
              className={cn(
                "w-full rounded-xl border p-4 text-left transition-colors",
                selected ? "border-primary bg-primary/10" : "border-gray-800 bg-gray-950/40 hover:border-gray-600"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white">{campaign.name}</p>
                {campaign.is_default && <span className="text-[11px] text-primary">Default</span>}
              </div>
              {campaign.goal && <p className="mt-1 text-xs text-gray-400 line-clamp-2">{campaign.goal}</p>}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

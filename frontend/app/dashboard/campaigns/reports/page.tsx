"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CampaignService } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CampaignHealthBadge } from "@/components/campaign/CampaignHealthBadge";
import type { CampaignProgressReportData } from "@/components/campaign/CampaignProgressReportView";

const RISK_ORDER = ["at_risk", "underperforming", "on_track", "exceeding", "unknown"];

export default function CampaignReportsInboxPage() {
  const { data, isLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_REPORTS_INBOX("site"),
    queryFn: async () => {
      const res = await CampaignService.getSiteReportsInbox();
      return res.data.data as Array<{
        campaign: { _id: string; name: string };
        report: CampaignProgressReportData;
      }>;
    },
  });

  const sorted = [...(data ?? [])].sort((a, b) => {
    const ai = RISK_ORDER.indexOf(a.report.health_status?.toLowerCase() ?? "unknown");
    const bi = RISK_ORDER.indexOf(b.report.health_status?.toLowerCase() ?? "unknown");
    return ai - bi;
  });

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: "Daily reports" },
          ]}
        />
        <h1 className="text-3xl font-display text-white mt-4 mb-2">Campaign reports</h1>
        <p className="text-gray-400 mb-8">Today&apos;s progress across active campaigns — at-risk first.</p>

        {isLoading ? (
          <p className="text-gray-400 text-center py-12">Loading reports…</p>
        ) : sorted.length === 0 ? (
          <p className="text-gray-400 text-center py-12">No active campaigns with reports yet.</p>
        ) : (
          <div className="space-y-4">
            {sorted.map(({ campaign, report }) => (
              <Link
                key={campaign._id}
                href={`/dashboard/campaigns/${campaign._id}?tab=progress`}
                className="block bg-gray-900 rounded-lg border border-gray-800 p-5 hover:border-gray-600 transition-colors"
              >
                <div className="flex justify-between items-start gap-4 mb-2">
                  <h2 className="text-lg font-semibold text-white">{campaign.name}</h2>
                  <CampaignHealthBadge status={report.health_status} />
                </div>
                <p className="text-sm text-gray-400 line-clamp-2">{report.narrative_summary}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {Math.round(report.progress.percent_complete)}% complete ·{" "}
                  {report.progress.awaiting_approval} awaiting approval
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

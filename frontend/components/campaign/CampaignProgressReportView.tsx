"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CampaignHealthBadge } from "./CampaignHealthBadge";

export interface CampaignProgressReportData {
  report_date: string;
  narrative_summary: string;
  health_status: string;
  health_reasons?: string[];
  progress: {
    percent_complete: number;
    days_remaining: number;
    awaiting_approval: number;
    published: number;
    total_planned: number;
  };
  highlights: string[];
  risks: string[];
  recommendations: string[];
  pending_approvals?: Array<{ title: string; due_at: string; scheduled_post_id?: string }>;
  upcoming_7d?: Array<{ title: string; scheduled_at: string; status: string }>;
}

export function CampaignProgressReportView({
  report,
  onRefresh,
  refreshing,
}: {
  report: CampaignProgressReportData;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-16 h-16 rounded-full border-4 border-primary flex items-center justify-center text-lg font-bold"
            aria-label={`${report.progress.percent_complete}% complete`}
          >
            {Math.round(report.progress.percent_complete)}%
          </div>
          <div>
            <p className="text-sm text-gray-400">Report date: {report.report_date}</p>
            <CampaignHealthBadge status={report.health_status} />
            <p className="text-xs text-gray-500 mt-1">
              {report.progress.days_remaining} days remaining · {report.progress.published}/
              {report.progress.total_planned} published
            </p>
          </div>
        </div>
        {onRefresh && (
          <Button
            variant="outline"
            className="border-gray-700 text-gray-300"
            onClick={onRefresh}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing…" : "Refresh report"}
          </Button>
        )}
      </div>

      <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
        <h3 className="text-lg font-semibold text-white mb-2">Operator brief</h3>
        <p className="text-gray-300 leading-relaxed">{report.narrative_summary}</p>
      </section>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Highlights</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            {(report.highlights.length ? report.highlights : ["No highlights yet."]).map((h, i) => (
              <li key={i}>• {h}</li>
            ))}
          </ul>
        </section>
        <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Risks</h3>
          <ul className="space-y-2 text-sm text-amber-200/90">
            {(report.risks.length ? report.risks : report.health_reasons ?? ["No risks flagged."]).map(
              (r, i) => (
                <li key={i}>• {r}</li>
              )
            )}
          </ul>
        </section>
      </div>

      {report.recommendations.length > 0 && (
        <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-3">Recommendations</h3>
          <ul className="space-y-2 text-sm text-gray-300">
            {report.recommendations.map((r, i) => (
              <li key={i}>• {r}</li>
            ))}
          </ul>
        </section>
      )}

      {(report.pending_approvals?.length ?? 0) > 0 && (
        <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-white">Pending approvals</h3>
            <Link href="/dashboard/approvals" className="text-primary text-sm hover:underline">
              Open approvals inbox →
            </Link>
          </div>
          <div className="space-y-2">
            {report.pending_approvals!.map((p, i) => (
              <div key={i} className="flex justify-between text-sm border-b border-gray-800 pb-2">
                <span className="text-white">{p.title}</span>
                <span className="text-gray-400">Due {new Date(p.due_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {(report.upcoming_7d?.length ?? 0) > 0 && (
        <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <h3 className="text-lg font-semibold text-white mb-3">Upcoming 7 days</h3>
          <div className="space-y-2">
            {report.upcoming_7d!.map((u, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span className="text-white">{u.title}</span>
                <span className="text-gray-400 capitalize">
                  {new Date(u.scheduled_at).toLocaleDateString()} · {u.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

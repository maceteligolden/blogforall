"use client";

import { useAdminTokenUsageDaily, useAdminTokenUsageDailyByUser } from "@/lib/hooks/use-admin-token-usage";

export default function AdminTokenUsagePage() {
  const { data: daily } = useAdminTokenUsageDaily();
  const { data: dailyByUser } = useAdminTokenUsageDailyByUser();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Token usage</h1>
        <p className="text-sm text-gray-400">Daily overall and per-user token usage.</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Daily usage (overall)</h2>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {(daily ?? []).map((row) => (
                <tr key={row.date} className="border-t border-gray-800">
                  <td className="p-3 text-gray-200">{row.date}</td>
                  <td className="p-3 text-gray-200">{row.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Daily usage (by user)</h2>
        <div className="rounded-lg border border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-900/80 text-gray-300">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">User</th>
                <th className="text-left p-3">Email</th>
                <th className="text-left p-3">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {(dailyByUser ?? []).map((row) => (
                <tr key={`${row.date}-${row.user_id}`} className="border-t border-gray-800">
                  <td className="p-3 text-gray-200">{row.date}</td>
                  <td className="p-3 text-gray-200">{row.user_name}</td>
                  <td className="p-3 text-gray-400">{row.user_email}</td>
                  <td className="p-3 text-gray-200">{row.tokens.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

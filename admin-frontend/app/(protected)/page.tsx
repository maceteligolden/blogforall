"use client";

import { useEffect } from "react";
import { StatCard, StatCardGrid } from "@/components/dashboard/stat-card";
import { useAdminStats } from "@/lib/hooks/use-admin-stats";
import { useAuthStore } from "@/lib/store/auth.store";
import { useRouter } from "next/navigation";

export default function AdminDashboardPage() {
  const router = useRouter();
  const { data: stats, isLoading, isError, refetch } = useAdminStats();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "d03c4e" },
      body: JSON.stringify({
        sessionId: "d03c4e",
        runId: "netlify-404",
        hypothesisId: "H2",
        location: "admin-frontend/app/(protected)/page.tsx:16",
        message: "Dashboard page rendered",
        data: { path: window.location.pathname, host: window.location.host },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-gray-400">
          Welcome back{user ? `, ${user.first_name}` : ""}. Platform overview at a glance.
        </p>
      </div>

      {isError && (
        <div className="rounded-md border border-red-800 bg-red-900/30 p-4 text-sm text-red-200">
          Failed to load stats.{" "}
          <button type="button" onClick={() => refetch()} className="underline hover:text-white">
            Retry
          </button>
        </div>
      )}

      <StatCardGrid>
        <StatCard
          label="Total users"
          value={stats?.total_users ?? "—"}
          description="Customer accounts (role: user)"
          loading={isLoading}
          onClick={() => router.push("/users")}
        />
        <StatCard
          label="Total blogs"
          value={stats?.total_blogs ?? "—"}
          description="All blog posts across workspaces"
          loading={isLoading}
          onClick={() => router.push("/blogs")}
        />
        <StatCard
          label="Total token usage"
          value={stats?.total_token_usage ?? "—"}
          description="All tracked token usage"
          loading={isLoading}
          onClick={() => router.push("/token-usage")}
        />
        <StatCard
          label="Platform admins"
          value={stats?.total_platform_admins ?? "—"}
          description="Admin and super_admin accounts"
          loading={isLoading}
          onClick={() => router.push("/admins/new")}
        />
      </StatCardGrid>
    </div>
  );
}

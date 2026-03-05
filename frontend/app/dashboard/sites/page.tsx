"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { SiteService, Site } from "@/lib/api/services/site.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { Building2, Settings, Users, ChevronRight } from "lucide-react";

export default function WorkspacesListPage() {
  const { currentSiteId } = useAuthStore();

  const { data: sites = [], isLoading } = useQuery({
    queryKey: QUERY_KEYS.SITES,
    queryFn: () => SiteService.getSites(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <Breadcrumb items={[{ label: "Dashboard" }, { label: "Workspaces" }]} />
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            <p className="text-gray-400">Loading workspaces...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Dashboard" }, { label: "Workspaces" }]} />

        <main className="py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-display mb-2 tracking-tight">Workspaces</h1>
            <p className="text-gray-400">Manage your workspaces, members, and settings</p>
          </div>

          {sites.length === 0 ? (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
              <Building2 className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No workspaces yet</h3>
              <p className="text-gray-400">Create a workspace from the site switcher in the navbar</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(sites as (Site & { memberCount?: number })[]).map((site) => (
                <div
                  key={site._id}
                  className="bg-gray-900 rounded-lg border border-gray-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-semibold text-white truncate">{site.name}</h2>
                        {currentSiteId === site._id && (
                          <span className="text-xs px-2 py-0.5 rounded bg-primary/20 text-primary border border-primary/30">
                            Current
                          </span>
                        )}
                      </div>
                      {site.description && (
                        <p className="text-sm text-gray-400 truncate mt-0.5">{site.description}</p>
                      )}
                      {"memberCount" in site && (
                        <p className="text-xs text-gray-500 mt-1">
                          {site.memberCount ?? 0} member{(site.memberCount ?? 0) !== 1 ? "s" : ""}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/dashboard/sites/${site._id}/settings`}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm"
                    >
                      <Settings className="w-4 h-4" />
                      Settings
                    </Link>
                    <Link
                      href="/dashboard/sites/members"
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white transition-colors text-sm"
                    >
                      <Users className="w-4 h-4" />
                      Members
                    </Link>
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

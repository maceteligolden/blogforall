"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plug, BarChart3, Globe } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { IntegrationService, type IntegrationCatalogItem } from "@/lib/api/services/integration.service";

function IntegrationCard({ item }: { item: IntegrationCatalogItem }) {
  const comingSoon = item.action === "coming_soon";
  const href =
    item.action === "manage"
      ? `/dashboard/integrations/${item.provider}`
      : item.action === "configure"
        ? `/dashboard/integrations/${item.provider}/configure`
        : undefined;
  const Icon = item.category === "analytics" ? BarChart3 : item.provider === "framer" ? Globe : Plug;

  return (
    <div className={`rounded-xl border border-gray-800 bg-gray-900/60 p-5 ${comingSoon ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-gray-200" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">{item.label}</h2>
            {item.connected && (
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border border-green-700 text-green-300">
                Connected
              </span>
            )}
          </div>
          <p className="text-sm text-gray-400 mt-1">{item.description}</p>
          <div className="mt-4">
            {comingSoon ? (
              <span className="text-xs text-gray-500">Coming soon</span>
            ) : href ? (
              <Link
                href={href}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
              >
                {item.action === "manage" ? "Manage" : "Configure"}
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const query = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.INTEGRATIONS(currentSiteId) : ["integrations", "none"],
    queryFn: () => IntegrationService.list(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  if (!currentSiteId || query.isLoading) {
    return <PageLoading breadcrumbItems={[{ label: "Integrations" }]} message="Loading integrations..." />;
  }

  if (query.isError) {
    return (
      <div className="p-4 lg:p-6">
        <Breadcrumb items={[{ label: "Integrations" }]} />
        <p className="text-sm text-red-300 mt-4">Failed to load integrations. Try refreshing.</p>
      </div>
    );
  }

  const cms = (query.data ?? []).filter((item) => item.category === "cms");
  const analytics = (query.data ?? []).filter((item) => item.category === "analytics");

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Integrations" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-display text-white">Integrations</h1>
        <p className="text-sm text-gray-400 mt-1">
          Connect a CMS or analytics source. Bloggr stays the source of truth for drafts.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-300 mb-3">CMS</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {cms.map((item) => (
            <IntegrationCard key={item.provider} item={item} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-300 mb-3">Analytics</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {analytics.map((item) => (
            <IntegrationCard key={item.provider} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}

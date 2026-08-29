"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plug, BarChart3, Globe, KeyRound } from "lucide-react";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { IntegrationService, type IntegrationCatalogItem } from "@/lib/api/services/integration.service";
import { ConfigureFramerDialog } from "@/components/integrations/configure-framer-dialog";
import { ConfigureApiDialog } from "@/components/integrations/configure-api-dialog";
import { useApiKeys } from "@/lib/hooks/use-api-key";

function IntegrationCard({ item, onConfigure }: { item: IntegrationCatalogItem; onConfigure?: () => void }) {
  const comingSoon = item.action === "coming_soon";
  const manageHref = item.action === "manage" ? `/dashboard/integrations/${item.provider}` : undefined;
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
            ) : manageHref ? (
              <Link
                href={manageHref}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
              >
                Manage
              </Link>
            ) : item.action === "configure" && onConfigure ? (
              <button
                type="button"
                onClick={onConfigure}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
              >
                Configure
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function BloggrApiCard({
  keyCount,
  keysQueryFailed,
  onConfigure,
}: {
  keyCount: number;
  keysQueryFailed: boolean;
  onConfigure: () => void;
}) {
  const hasKeys = keyCount > 0;

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-700 bg-gray-800">
          <KeyRound className="h-5 w-5 text-gray-200" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Bloggr API</h2>
            {hasKeys ? (
              <span className="rounded-full border border-green-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-green-300">
                {keyCount === 1 ? "1 key" : `${keyCount} keys`}
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-gray-400">Read published posts from your own site or app.</p>
          <div className="mt-4">
            {hasKeys || keysQueryFailed ? (
              <Link
                href="/dashboard/integrations/api"
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
              >
                Manage keys
              </Link>
            ) : (
              <button
                type="button"
                onClick={onConfigure}
                className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
              >
                Configure
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const [framerOpen, setFramerOpen] = useState(false);
  const [apiOpen, setApiOpen] = useState(false);
  const query = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.INTEGRATIONS(currentSiteId) : ["integrations", "none"],
    queryFn: () => IntegrationService.list(currentSiteId as string),
    enabled: !!currentSiteId,
  });
  const keysQuery = useApiKeys(currentSiteId ?? undefined);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const configure = new URLSearchParams(window.location.search).get("configure");
    if (configure === "framer") setFramerOpen(true);
    if (configure === "api") setApiOpen(true);
  }, []);

  const closeFramer = () => {
    setFramerOpen(false);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("configure") === "framer") {
      router.replace("/dashboard/integrations");
    }
  };

  const closeApi = () => {
    setApiOpen(false);
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("configure") === "api") {
      router.replace("/dashboard/integrations");
    }
  };

  if (!currentSiteId || query.isLoading || keysQuery.isLoading) {
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
  const keyCount = Array.isArray(keysQuery.data) ? keysQuery.data.length : 0;

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Integrations" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-display text-white">Integrations</h1>
        <p className="text-sm text-gray-400 mt-1">
          Connect a CMS, use the Bloggr API on your own site, or add analytics later.
        </p>
      </div>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-300 mb-3">API</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <BloggrApiCard keyCount={keyCount} keysQueryFailed={keysQuery.isError} onConfigure={() => setApiOpen(true)} />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-medium text-gray-300 mb-3">CMS</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {cms.map((item) => (
            <IntegrationCard
              key={item.provider}
              item={item}
              onConfigure={item.provider === "framer" ? () => setFramerOpen(true) : undefined}
            />
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

      <ConfigureFramerDialog isOpen={framerOpen} onClose={closeFramer} />
      <ConfigureApiDialog isOpen={apiOpen} onClose={closeApi} />
    </div>
  );
}

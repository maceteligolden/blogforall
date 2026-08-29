"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuthStore } from "@/lib/store/auth.store";
import { cn } from "@/lib/utils/cn";
import { ConfigureApiDialog } from "@/components/integrations/configure-api-dialog";
import { ApiKeysManager } from "@/components/integrations/api-keys-manager";
import { ApiGuides } from "@/components/integrations/api-guides";

const TABS = [
  { id: "keys", label: "Keys" },
  { id: "guides", label: "Guides" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function parseTab(value: string | null): TabId {
  return value === "guides" ? "guides" : "keys";
}

function ManageBloggrApiContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const activeTab = parseTab(searchParams.get("tab"));
  const [createOpen, setCreateOpen] = useState(false);

  const setTab = (tab: TabId) => {
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "keys") params.delete("tab");
    else params.set("tab", tab);
    const qs = params.toString();
    router.replace(qs ? `/dashboard/integrations/api?${qs}` : "/dashboard/integrations/api", { scroll: false });
  };

  if (!currentSiteId) {
    return (
      <PageLoading
        breadcrumbItems={[{ label: "Integrations", href: "/dashboard/integrations" }, { label: "Bloggr API" }]}
        message="Select a workspace…"
      />
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Integrations", href: "/dashboard/integrations" }, { label: "Bloggr API" }]} />
      <div className="mb-6">
        <h1 className="text-2xl font-display text-white">Bloggr API</h1>
        <p className="mt-1 text-sm text-gray-400">
          Keys for this workspace and copy-paste guides for HTML, React, Node.js, and Python.
        </p>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={cn(
              "shrink-0 px-4 pb-3 text-sm font-medium transition-colors",
              activeTab === tab.id ? "border-b-2 border-primary text-primary" : "text-gray-400 hover:text-white"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "keys" ? (
        <ApiKeysManager onCreate={() => setCreateOpen(true)} />
      ) : (
        <ApiGuides onCreateKey={() => setCreateOpen(true)} />
      )}

      <ConfigureApiDialog
        isOpen={createOpen}
        onClose={() => setCreateOpen(false)}
        onOpenGuides={() => {
          setCreateOpen(false);
          setTab("guides");
        }}
      />
    </div>
  );
}

export default function ManageBloggrApiPage() {
  return (
    <Suspense
      fallback={
        <PageLoading
          breadcrumbItems={[{ label: "Integrations", href: "/dashboard/integrations" }, { label: "Bloggr API" }]}
          message="Loading Bloggr API…"
        />
      }
    >
      <ManageBloggrApiContent />
    </Suspense>
  );
}

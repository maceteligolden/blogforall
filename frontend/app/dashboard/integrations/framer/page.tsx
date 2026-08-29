"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { PageLoading } from "@/components/ui/page-loading";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { IntegrationService } from "@/lib/api/services/integration.service";
import { useToast } from "@/components/ui/toast";

export default function ManageFramerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const query = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.FRAMER_INTEGRATION(currentSiteId) : ["framer", "none"],
    queryFn: () => IntegrationService.getFramer(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const syncMutation = useMutation({
    mutationFn: () => IntegrationService.syncFramer(currentSiteId as string),
    onSuccess: (data) => {
      if (currentSiteId) queryClient.setQueryData(QUERY_KEYS.FRAMER_INTEGRATION(currentSiteId), data);
      toast({ variant: "success", description: "Synced posts from Framer." });
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast({ variant: "error", description: message ?? "Sync failed." });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => IntegrationService.disconnectFramer(currentSiteId as string),
    onSuccess: async () => {
      if (currentSiteId) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATIONS(currentSiteId) });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_DESTINATIONS(currentSiteId) });
        queryClient.removeQueries({ queryKey: QUERY_KEYS.FRAMER_INTEGRATION(currentSiteId) });
      }
      toast({ variant: "success", description: "Framer disconnected." });
      router.push("/dashboard/integrations");
    },
  });

  if (!currentSiteId || query.isLoading) {
    return (
      <PageLoading
        breadcrumbItems={[{ label: "Integrations", href: "/dashboard/integrations" }, { label: "Framer" }]}
        message="Loading Framer…"
      />
    );
  }

  if (query.isError || !query.data) {
    return (
      <div className="p-6">
        <p className="text-gray-400 mb-3">Framer is not connected.</p>
        <Link
          href="/dashboard/integrations?configure=framer"
          className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
        >
          Configure
        </Link>
      </div>
    );
  }

  const { connection, deliveries, metrics } = query.data;

  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Integrations", href: "/dashboard/integrations" }, { label: "Framer" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-display text-white">Framer</h1>
          <p className="text-sm text-gray-400 mt-1">Connection details, published posts, and delivery metrics.</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="border-gray-700 text-gray-200"
          >
            {syncMutation.isPending ? "Syncing…" : "Refresh"}
          </Button>
          <Button variant="outline" onClick={() => setConfirmDisconnect(true)} className="border-red-800 text-red-300">
            Disconnect
          </Button>
        </div>
      </div>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 p-5 mb-6">
        <h2 className="text-sm font-medium text-white mb-3">Connection</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-gray-500">Project</dt>
            <dd className="text-gray-200 break-all">{connection.config.projectUrl}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Collection</dt>
            <dd className="text-gray-200">{connection.config.collectionName}</dd>
          </div>
          <div>
            <dt className="text-gray-500">API key</dt>
            <dd className="text-gray-200">{connection.maskedApiKey}</dd>
          </div>
          <div>
            <dt className="text-gray-500">Last verified</dt>
            <dd className="text-gray-200">
              {connection.lastVerifiedAt ? new Date(connection.lastVerifiedAt).toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Last deploy</dt>
            <dd className="text-gray-200">
              {metrics.lastPublishedAt ? new Date(metrics.lastPublishedAt).toLocaleString() : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-gray-500">Last sync</dt>
            <dd className="text-gray-200">
              {metrics.lastSyncedAt ? new Date(metrics.lastSyncedAt).toLocaleString() : "—"}
            </dd>
          </div>
          {connection.lastError && (
            <div className="sm:col-span-2">
              <dt className="text-gray-500">Last error</dt>
              <dd className="text-red-300">{connection.lastError}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="grid gap-4 sm:grid-cols-3 mb-6">
        {[
          { label: "Published", value: metrics.published },
          { label: "Failed", value: metrics.failed },
          { label: "In flight", value: metrics.pending },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
            <p className="text-xs uppercase tracking-wide text-gray-500">{card.label}</p>
            <p className="text-2xl text-white mt-1">{card.value}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-gray-800 bg-gray-900/60 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-800">
          <h2 className="text-sm font-medium text-white">Posts</h2>
        </div>
        {deliveries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-gray-400">
            No Framer deliveries yet. Publish a post with Framer selected.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="px-5 py-2 font-medium">Post</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium">Attempts</th>
                <th className="px-5 py-2 font-medium">Live URL</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id} className="border-t border-gray-800">
                  <td className="px-5 py-2 text-gray-200">
                    <a className="hover:text-primary" href={`/dashboard/posts/${delivery.blog_id}`}>
                      {delivery.blog_id}
                    </a>
                  </td>
                  <td className="px-5 py-2 text-gray-300">{delivery.status}</td>
                  <td className="px-5 py-2 text-gray-400">{delivery.attempts}</td>
                  <td className="px-5 py-2">
                    {delivery.external_url ? (
                      <a
                        href={delivery.external_url}
                        className="text-primary hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open
                      </a>
                    ) : (
                      <span className="text-gray-500">{delivery.last_error ?? "—"}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <ConfirmModal
        isOpen={confirmDisconnect}
        onClose={() => setConfirmDisconnect(false)}
        onConfirm={() => disconnectMutation.mutate()}
        title="Disconnect Framer?"
        message="The AI will stop offering Framer as a publish destination. Existing Framer CMS items are left in place."
        confirmText="Disconnect"
        variant="danger"
        isConfirming={disconnectMutation.isPending}
        closeOnConfirm={false}
      />
    </div>
  );
}

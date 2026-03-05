"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { SiteService, Site } from "@/lib/api/services/site.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { ArrowLeft, Trash2 } from "lucide-react";
import Link from "next/link";

export default function WorkspaceSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const siteId = params?.id as string;
  const queryClient = useQueryClient();
  const { currentSiteId, setCurrentSiteId } = useAuthStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const { data: site, isLoading } = useQuery({
    queryKey: siteId ? QUERY_KEYS.SITE(siteId) : [],
    queryFn: () => SiteService.getSiteById(siteId),
    enabled: !!siteId,
  });

  useEffect(() => {
    if (site) {
      setName(site.name);
      setDescription(site.description ?? "");
    }
  }, [site]);

  const updateMutation = useMutation({
    mutationFn: (data: { name?: string; description?: string }) =>
      SiteService.updateSite(siteId, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(QUERY_KEYS.SITE(siteId), updated);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => SiteService.deleteSite(siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      if (currentSiteId === siteId) {
        setCurrentSiteId(null);
      }
      router.push("/dashboard/sites");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({ name, description });
  };

  if (!siteId) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <p className="text-gray-400">Invalid workspace</p>
          <Link href="/dashboard/sites" className="text-primary hover:underline mt-2 inline-block">
            Back to workspaces
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !site) {
    return (
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <Breadcrumb items={[{ label: "Dashboard" }, { label: "Workspaces" }, { label: "Settings" }]} />
          <div className="py-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4" />
            <p className="text-gray-400">Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Dashboard" },
            { label: "Workspaces", href: "/dashboard/sites" },
            { label: site.name },
            { label: "Settings" },
          ]}
        />

        <div className="mt-6">
          <Link
            href="/dashboard/sites"
            className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to workspaces
          </Link>
        </div>

        <main className="py-6 space-y-10">
          <section className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Workspace details</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                  placeholder="Workspace name"
                  required
                />
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2 rounded-md bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  placeholder="Brief description"
                />
              </div>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                {updateMutation.isPending ? "Saving..." : "Save changes"}
              </Button>
            </form>
          </section>

          <section className="bg-gray-900 rounded-lg border border-red-900/50 p-6">
            <h2 className="text-lg font-semibold text-white mb-2">Danger zone</h2>
            <p className="text-sm text-gray-400 mb-4">
              Deleting this workspace will remove all blogs, members, and data. This cannot be undone.
            </p>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={deleteMutation.isPending}
              className="border-red-800 text-red-400 hover:bg-red-900/20 hover:text-red-300"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete workspace
            </Button>
          </section>
        </main>
      </div>

      {showDeleteConfirm && (
        <ConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={() => deleteMutation.mutate()}
          title="Delete workspace"
          message={`Are you sure you want to delete "${site.name}"? All blogs and data in this workspace will be permanently removed.`}
          confirmText="Delete"
          cancelText="Cancel"
          variant="danger"
        />
      )}
    </div>
  );
}

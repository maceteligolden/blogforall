"use client";

import { useState } from "react";
import { ChevronDown, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/modal";
import { useApiKeys, useDeleteApiKey } from "@/lib/hooks/use-api-key";
import { useAuthStore } from "@/lib/store/auth.store";
import { cn } from "@/lib/utils/cn";
import type { ApiKeyListItem } from "@/lib/api/services/api-key.service";
import { ApiCredentialRow } from "./api-credential-row";

function formatDate(value?: string) {
  if (!value) return "Never";
  return new Date(value).toLocaleString();
}

function maskAccessKey(accessKeyId: string) {
  if (accessKeyId.length <= 12) return accessKeyId;
  return `${accessKeyId.slice(0, 8)}…${accessKeyId.slice(-4)}`;
}

export function ApiKeysManager({ onCreate }: { onCreate: () => void }) {
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const { data: apiKeys, isLoading } = useApiKeys(currentSiteId ?? undefined);
  const deleteApiKey = useDeleteApiKey(currentSiteId ?? undefined);
  const [error, setError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  const keys = (apiKeys ?? []) as ApiKeyListItem[];

  const handleDeleteConfirm = async () => {
    if (!keyToDelete || !currentSiteId) return;
    try {
      await deleteApiKey.mutateAsync(keyToDelete);
      setKeyToDelete(null);
      setError("");
    } catch {
      setError("Failed to delete API key");
    }
  };

  if (!currentSiteId) {
    return <p className="text-sm text-gray-400">Choose a workspace to manage API keys.</p>;
  }

  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading API keys…</p>;
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Workspace keys</h2>
          <p className="mt-1 text-sm text-gray-400">
            Use these from your server. Do not put the secret in frontend code.
          </p>
        </div>
        <Button className="shrink-0 bg-primary text-white hover:bg-primary/90" onClick={onCreate}>
          Create key
        </Button>
      </div>

      {error ? (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      ) : null}

      {keys.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800 bg-gray-900/40 px-6 py-12 text-center">
          <KeyRound className="mx-auto h-8 w-8 text-gray-500" aria-hidden="true" />
          <p className="mt-3 text-sm text-gray-300">No API keys yet</p>
          <p className="mt-1 text-sm text-gray-500">Create a key to fetch published posts from your own site or app.</p>
          <Button className="mt-4 bg-primary text-white hover:bg-primary/90" onClick={onCreate}>
            Create your first key
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {keys.map((key) => (
            <ApiKeyCard
              key={key.id}
              apiKey={key}
              deleteDisabled={deleteApiKey.isPending}
              onDelete={() => {
                setKeyToDelete(key.accessKeyId);
                setDeleteModalOpen(true);
              }}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setKeyToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete API key"
        message="This key will stop working immediately. Update any servers that still use it."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

function ApiKeyCard({
  apiKey,
  onDelete,
  deleteDisabled,
}: {
  apiKey: ApiKeyListItem;
  onDelete: () => void;
  deleteDisabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
  };

  return (
    <div className="rounded-xl border border-gray-800 bg-gray-900/60">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-start gap-3 rounded-md px-1 py-1 text-left hover:bg-gray-800/50"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("mt-1 h-4 w-4 shrink-0 text-gray-500 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{apiKey.name}</span>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide",
                  apiKey.isActive
                    ? "border border-green-800 bg-green-900/30 text-green-400"
                    : "border border-gray-700 bg-gray-800 text-gray-400"
                )}
              >
                {apiKey.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-1 font-mono text-xs text-gray-500">{maskAccessKey(apiKey.accessKeyId)}</p>
            <p className="mt-1 text-xs text-gray-500">
              Created {formatDate(apiKey.createdAt)} · Last used {formatDate(apiKey.lastUsed)}
            </p>
          </div>
        </button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-gray-700 bg-gray-800 text-red-400 hover:border-red-800 hover:bg-red-900/30 hover:text-red-300"
          onClick={onDelete}
          disabled={deleteDisabled}
        >
          Delete
        </Button>
      </div>

      {open ? (
        <div className="space-y-3 border-t border-gray-800 px-4 py-4 pl-12">
          <ApiCredentialRow
            label="Workspace public ID"
            value={apiKey.sitePublicId}
            onCopy={() => copy(apiKey.sitePublicId)}
          />
          <ApiCredentialRow label="Access Key ID" value={apiKey.accessKeyId} onCopy={() => copy(apiKey.accessKeyId)} />
          <ApiCredentialRow label="Secret Key" value={apiKey.secretKey} onCopy={() => copy(apiKey.secretKey)} obscure />
        </div>
      ) : null}
    </div>
  );
}

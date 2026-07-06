"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/lib/hooks/use-api-key";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmModal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/cn";
import type { ApiKeyListItem } from "@/lib/api/services/api-key.service";

export function ApiKeysPanel() {
  const { currentSiteId } = useAuth();
  const { data: apiKeys, isLoading } = useApiKeys(currentSiteId ?? undefined);
  const createApiKey = useCreateApiKey(currentSiteId ?? undefined);
  const deleteApiKey = useDeleteApiKey(currentSiteId ?? undefined);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    accessKeyId: string;
    secretKey: string;
    sitePublicId: string;
  } | null>(null);
  const [error, setError] = useState("");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [keyToDelete, setKeyToDelete] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentSiteId) {
      setError("Select a workspace in the header first.");
      return;
    }

    if (!newKeyName.trim()) {
      setError("Name is required");
      return;
    }

    try {
      const response = await createApiKey.mutateAsync({ name: newKeyName.trim() });
      const keyData = response.data.data;
      setNewlyCreatedKey({
        accessKeyId: keyData.accessKeyId,
        secretKey: keyData.secretKey,
        sitePublicId: keyData.sitePublicId,
      });
      setNewKeyName("");
      setShowCreateForm(false);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create API key";
      setError(errorMessage);
    }
  };

  const handleDeleteConfirm = async () => {
    if (keyToDelete && currentSiteId) {
      try {
        await deleteApiKey.mutateAsync(keyToDelete);
        setKeyToDelete(null);
      } catch {
        setError("Failed to delete API key");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!currentSiteId) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="mb-4 text-gray-400">Choose a workspace in the site switcher to manage API keys.</p>
        <Link href="/dashboard/sites" className="text-primary hover:underline">
          View workspaces
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-gray-400">Loading API keys...</p>
        </div>
      </div>
    );
  }

  const keys = (apiKeys ?? []) as ApiKeyListItem[];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-white">API keys</h2>
          <p className="mt-1 text-sm text-gray-400">Create keys for programmatic access to this workspace.</p>
        </div>
        <Button className="shrink-0 bg-primary text-white hover:bg-primary/90" onClick={() => setShowCreateForm(true)}>
          Create API key
        </Button>
      </div>

      {newlyCreatedKey && (
        <div className="mb-6 rounded-lg border border-yellow-800 bg-yellow-900/20 p-6">
          <h3 className="mb-4 text-lg font-semibold text-yellow-400">New API key credentials</h3>
          <p className="mb-4 text-sm text-yellow-300">
            Copy and store these values. The secret is shown here while the key exists.
          </p>
          <div className="space-y-4">
            <CredentialRow
              label="Workspace public ID"
              value={newlyCreatedKey.sitePublicId}
              onCopy={() => copyToClipboard(newlyCreatedKey.sitePublicId)}
            />
            <CredentialRow
              label="Access Key ID"
              value={newlyCreatedKey.accessKeyId}
              onCopy={() => copyToClipboard(newlyCreatedKey.accessKeyId)}
            />
            <CredentialRow
              label="Secret Key"
              value={newlyCreatedKey.secretKey}
              onCopy={() => copyToClipboard(newlyCreatedKey.secretKey)}
              obscure
            />
          </div>
          <Button className="mt-4 bg-primary text-white hover:bg-primary/90" onClick={() => setNewlyCreatedKey(null)}>
            Done
          </Button>
        </div>
      )}

      {showCreateForm && (
        <div className="mb-6 rounded-lg border border-gray-800 bg-gray-900 p-6">
          <h3 className="mb-4 text-lg font-semibold text-white">Create new API key</h3>
          {error && (
            <div className="mb-4 rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
          )}
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="key-name">Key name</Label>
              <Input
                id="key-name"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Production API key"
                className="mt-1"
                required
                maxLength={100}
              />
            </div>
            <div className="flex space-x-4">
              <Button type="submit" className="bg-primary text-white hover:bg-primary/90" disabled={createApiKey.isPending}>
                {createApiKey.isPending ? "Creating..." : "Create API key"}
              </Button>
              <Button
                type="button"
                className="border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
                onClick={() => {
                  setShowCreateForm(false);
                  setNewKeyName("");
                  setError("");
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </div>
      )}

      {error && !showCreateForm && (
        <div className="mb-6 rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
      )}

      {keys.length === 0 ? (
        <div className="rounded-lg border border-gray-800 bg-gray-900 p-12 text-center">
          <p className="mb-4 text-gray-400">No API keys for this workspace.</p>
          <Button className="bg-primary text-white hover:bg-primary/90" onClick={() => setShowCreateForm(true)}>
            Create your first API key
          </Button>
        </div>
      ) : (
        <div className="rounded-lg border border-gray-800 bg-gray-900">
          <div className="divide-y divide-gray-800">
            {keys.map((key) => (
              <ApiKeyCollapsibleItem
                key={key.id}
                apiKey={key}
                onDelete={() => {
                  setKeyToDelete(key.accessKeyId);
                  setDeleteModalOpen(true);
                }}
                deleteDisabled={deleteApiKey.isPending}
                onCopy={copyToClipboard}
              />
            ))}
          </div>
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
        message="Are you sure you want to delete this API key? It will no longer work."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

function ApiKeyCollapsibleItem({
  apiKey,
  onDelete,
  deleteDisabled,
  onCopy,
}: {
  apiKey: ApiKeyListItem;
  onDelete: () => void;
  deleteDisabled: boolean;
  onCopy: (text: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const accessKeyPreview =
    apiKey.accessKeyId.length > 12
      ? `${apiKey.accessKeyId.slice(0, 8)}…${apiKey.accessKeyId.slice(-4)}`
      : apiKey.accessKeyId;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md px-2 py-2 text-left transition-colors hover:bg-gray-800/60"
          aria-expanded={open}
        >
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-gray-500 transition-transform", open && "rotate-180")}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-white">{apiKey.name}</span>
              <span
                className={cn(
                  "rounded px-2 py-0.5 text-xs",
                  apiKey.isActive
                    ? "border border-green-800 bg-green-900/30 text-green-400"
                    : "border border-gray-700 bg-gray-800 text-gray-400"
                )}
              >
                {apiKey.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <p className="mt-0.5 truncate font-mono text-xs text-gray-500">{accessKeyPreview}</p>
          </div>
        </button>
        <Button
          type="button"
          size="sm"
          className="shrink-0 border border-gray-700 bg-gray-800 text-red-400 hover:border-red-800 hover:bg-red-900/30"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleteDisabled}
        >
          Delete
        </Button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-gray-800 pt-4 pl-9">
          <CredentialRow
            label="Workspace public ID"
            value={apiKey.sitePublicId}
            onCopy={() => onCopy(apiKey.sitePublicId)}
          />
          <CredentialRow
            label="Access Key ID"
            value={apiKey.accessKeyId}
            onCopy={() => onCopy(apiKey.accessKeyId)}
          />
          <CredentialRow label="Secret Key" value={apiKey.secretKey} onCopy={() => onCopy(apiKey.secretKey)} obscure />
          <div className="text-sm text-gray-400">Created: {new Date(apiKey.createdAt).toLocaleString()}</div>
          {apiKey.lastUsed && (
            <div className="text-sm text-gray-400">Last used: {new Date(apiKey.lastUsed).toLocaleString()}</div>
          )}
        </div>
      )}
    </div>
  );
}

function CredentialRow({
  label,
  value,
  onCopy,
  obscure,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  obscure?: boolean;
}) {
  return (
    <div>
      <Label className="text-gray-400">{label}</Label>
      <div className="mt-1 flex items-center gap-2">
        <Input
          value={value}
          readOnly
          type={obscure ? "password" : "text"}
          className="border-gray-700 bg-black font-mono text-sm text-gray-300"
        />
        <Button
          type="button"
          className="shrink-0 border border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700"
          size="sm"
          onClick={onCopy}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

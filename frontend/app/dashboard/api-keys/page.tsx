"use client";

import { useState } from "react";
import Link from "next/link";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/lib/hooks/use-api-key";
import { useAuth } from "@/lib/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ConfirmModal } from "@/components/ui/modal";
import type { ApiKeyListItem } from "@/lib/api/services/api-key.service";

export default function ApiKeysPage() {
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
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create API key";
      setError(errorMessage);
    }
  };

  const handleDeleteClick = (accessKeyId: string) => {
    setKeyToDelete(accessKeyId);
    setDeleteModalOpen(true);
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
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <Breadcrumb items={[{ label: "API Keys" }]} />
          <div className="max-w-4xl mx-auto mt-8 rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
            <p className="text-gray-400 mb-4">Choose a workspace in the site switcher to manage API keys.</p>
            <Link href="/dashboard/sites" className="text-primary hover:underline">
              View workspaces
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading API keys...</p>
        </div>
      </div>
    );
  }

  const keys = (apiKeys ?? []) as ApiKeyListItem[];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "API Keys" }]} />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display text-white">API Keys</h1>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => setShowCreateForm(true)}
          >
            Create API Key
          </Button>
        </div>

        <main className="max-w-4xl mx-auto">
          {newlyCreatedKey && (
            <div className="mb-6 bg-yellow-900/20 border border-yellow-800 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-yellow-400 mb-4">New API key credentials</h3>
              <p className="text-sm text-yellow-300 mb-4">
                Copy and store these values. The same secret is available on this page while the key exists
                (encrypted at rest on the server).
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
              <Button
                className="mt-4 bg-primary hover:bg-primary/90 text-white"
                onClick={() => setNewlyCreatedKey(null)}
              >
                Done
              </Button>
            </div>
          )}

          {showCreateForm && (
            <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="text-lg font-semibold text-white mb-4">Create New API Key</h3>
              {error && (
                <div className="mb-4 rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label htmlFor="key-name">Key Name</Label>
                  <Input
                    id="key-name"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    placeholder="e.g., Production API Key"
                    className="mt-1"
                    required
                    maxLength={100}
                  />
                </div>
                <div className="flex space-x-4">
                  <Button
                    type="submit"
                    className="bg-primary hover:bg-primary/90 text-white"
                    disabled={createApiKey.isPending}
                  >
                    {createApiKey.isPending ? "Creating..." : "Create API Key"}
                  </Button>
                  <Button
                    type="button"
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
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

          {keys.length === 0 ? (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
              <p className="text-gray-400 mb-4">No API keys for this workspace.</p>
              <Button className="bg-primary hover:bg-primary/90 text-white" onClick={() => setShowCreateForm(true)}>
                Create Your First API Key
              </Button>
            </div>
          ) : (
            <div className="bg-gray-900 rounded-lg border border-gray-800">
              <div className="p-6 border-b border-gray-800">
                <h2 className="text-lg font-semibold text-white">Your API Keys</h2>
                <p className="text-sm text-gray-400 mt-1">Keys are scoped to this workspace only.</p>
              </div>
              <div className="divide-y divide-gray-800">
                {keys.map((key) => (
                  <div key={key.id} className="p-6">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="flex-1 space-y-3">
                        <h3 className="text-lg font-medium text-white">{key.name}</h3>
                        <CredentialRow
                          label="Workspace public ID"
                          value={key.sitePublicId}
                          onCopy={() => copyToClipboard(key.sitePublicId)}
                        />
                        <CredentialRow
                          label="Access Key ID"
                          value={key.accessKeyId}
                          onCopy={() => copyToClipboard(key.accessKeyId)}
                        />
                        <CredentialRow
                          label="Secret Key"
                          value={key.secretKey}
                          onCopy={() => copyToClipboard(key.secretKey)}
                          obscure
                        />
                        <div className="text-sm text-gray-400">
                          Created: {new Date(key.createdAt).toLocaleString()}
                        </div>
                        {key.lastUsed && (
                          <div className="text-sm text-gray-400">
                            Last used: {new Date(key.lastUsed).toLocaleString()}
                          </div>
                        )}
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded ${
                            key.isActive
                              ? "bg-green-900/30 text-green-400 border border-green-800"
                              : "bg-gray-800 text-gray-400 border border-gray-700"
                          }`}
                        >
                          {key.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <Button
                        className="bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-800 shrink-0"
                        onClick={() => handleDeleteClick(key.accessKeyId)}
                        disabled={deleteApiKey.isPending}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 bg-blue-900/20 border border-blue-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-blue-400 mb-4">How to Use API Keys</h3>
            <div className="space-y-3 text-sm text-blue-300">
              <p>Send these headers. The key is tied to one workspace; you do not pass a separate site id.</p>
              <div className="bg-black border border-gray-700 rounded p-3 font-mono text-xs text-gray-300">
                <div>x-access-key-id: your_access_key_id</div>
                <div>x-secret-key: your_secret_key</div>
              </div>
              <p className="mt-3">Example:</p>
              <div className="bg-black border border-gray-700 rounded p-3 font-mono text-xs text-gray-300 break-all">
                curl -H &quot;x-access-key-id: YOUR_ACCESS_KEY&quot; \<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H &quot;x-secret-key: YOUR_SECRET&quot; \<br />
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;YOUR_API_URL/api/v1/public/blogs?page=1&amp;limit=10
              </div>
            </div>
          </div>
        </main>
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setKeyToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete API Key"
        message="Are you sure you want to delete this API key? It will no longer work."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
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
      <div className="flex items-center gap-2 mt-1">
        <Input
          value={value}
          readOnly
          type={obscure ? "password" : "text"}
          className="bg-black border-gray-700 text-gray-300 font-mono text-sm"
        />
        <Button
          type="button"
          className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 shrink-0"
          size="sm"
          onClick={onCopy}
        >
          Copy
        </Button>
      </div>
    </div>
  );
}

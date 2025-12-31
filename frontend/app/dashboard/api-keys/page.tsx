"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApiKeys, useCreateApiKey, useDeleteApiKey } from "@/lib/hooks/use-api-key";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function ApiKeysPage() {
  const router = useRouter();
  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const deleteApiKey = useDeleteApiKey();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<{
    accessKeyId: string;
    secretKey: string;
  } | null>(null);
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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

  const handleDelete = async (accessKeyId: string) => {
    if (confirm("Are you sure you want to delete this API key? It will no longer work.")) {
      try {
        await deleteApiKey.mutateAsync(accessKeyId);
      } catch (err) {
        setError("Failed to delete API key");
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

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

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-white">API Keys</h1>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => setShowCreateForm(true)}
            >
              Create API Key
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        {/* Newly Created Key Display */}
        {newlyCreatedKey && (
          <div className="mb-6 bg-yellow-900/20 border border-yellow-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-400 mb-4">
              ⚠️ Save Your API Key Credentials
            </h3>
            <p className="text-sm text-yellow-300 mb-4">
              This is the only time you&apos;ll be able to see the secret key. Make sure to save it
              securely.
            </p>
            <div className="space-y-4">
              <div>
                <Label className="text-yellow-400">Access Key ID</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={newlyCreatedKey.accessKeyId}
                    readOnly
                    className="bg-black border-gray-700 text-gray-300 font-mono text-sm"
                  />
                  <Button
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                    size="sm"
                    onClick={() => copyToClipboard(newlyCreatedKey.accessKeyId)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-yellow-400">Secret Key</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={newlyCreatedKey.secretKey}
                    readOnly
                    type="password"
                    className="bg-black border-gray-700 text-gray-300 font-mono text-sm"
                  />
                  <Button
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                    size="sm"
                    onClick={() => copyToClipboard(newlyCreatedKey.secretKey)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            <Button
              className="mt-4 bg-primary hover:bg-primary/90 text-white"
              onClick={() => {
                setNewlyCreatedKey(null);
              }}
            >
              I&apos;ve Saved My Credentials
            </Button>
          </div>
        )}

        {/* Create Form */}
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
                <p className="mt-1 text-xs text-gray-500">
                  Give your API key a descriptive name to identify it later
                </p>
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

        {/* API Keys List */}
        {!apiKeys || apiKeys.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <p className="text-gray-400 mb-4">No API keys found.</p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => setShowCreateForm(true)}
            >
              Create Your First API Key
            </Button>
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800">
            <div className="p-6 border-b border-gray-800">
              <h2 className="text-lg font-semibold text-white">Your API Keys</h2>
              <p className="text-sm text-gray-400 mt-1">
                Manage your API keys for accessing your blogs programmatically
              </p>
            </div>
            <div className="divide-y divide-gray-800">
              {apiKeys.map((key: any) => (
                <div key={key.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-white">{key.name}</h3>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-400">Access Key ID:</span>
                          <code className="text-sm font-mono bg-black border border-gray-700 text-gray-300 px-2 py-1 rounded">
                            {key.accessKeyId}
                          </code>
                          <Button
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                            size="sm"
                            onClick={() => copyToClipboard(key.accessKeyId)}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="text-sm text-gray-400">
                          Created: {new Date(key.createdAt).toLocaleDateString()}
                        </div>
                        {key.lastUsed && (
                          <div className="text-sm text-gray-400">
                            Last used: {new Date(key.lastUsed).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              key.isActive
                                ? "bg-green-900/30 text-green-400 border border-green-800"
                                : "bg-gray-800 text-gray-400 border border-gray-700"
                            }`}
                          >
                            {key.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      className="bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-800"
                      onClick={() => handleDelete(key.accessKeyId)}
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

        {/* Usage Instructions */}
        <div className="mt-8 bg-blue-900/20 border border-blue-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-400 mb-4">How to Use API Keys</h3>
          <div className="space-y-3 text-sm text-blue-300">
            <p>
              Include these headers in your API requests to authenticate:
            </p>
            <div className="bg-black border border-gray-700 rounded p-3 font-mono text-xs text-gray-300">
              <div>x-access-key-id: your_access_key_id</div>
              <div>x-secret-key: your_secret_key</div>
            </div>
            <p className="mt-3">
              Example using curl:
            </p>
            <div className="bg-black border border-gray-700 rounded p-3 font-mono text-xs text-gray-300">
              curl -H &quot;x-access-key-id: your_key&quot; \<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H &quot;x-secret-key: your_secret&quot; \<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;http://localhost:5005/api/v1/public/blogs
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


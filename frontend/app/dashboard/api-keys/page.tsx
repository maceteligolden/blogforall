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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading API keys...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">API Keys</h1>
            </div>
            <Button onClick={() => setShowCreateForm(true)}>Create API Key</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Newly Created Key Display */}
        {newlyCreatedKey && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-4">
              ⚠️ Save Your API Key Credentials
            </h3>
            <p className="text-sm text-yellow-800 mb-4">
              This is the only time you&apos;ll be able to see the secret key. Make sure to save it
              securely.
            </p>
            <div className="space-y-4">
              <div>
                <Label className="text-yellow-900">Access Key ID</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={newlyCreatedKey.accessKeyId}
                    readOnly
                    className="bg-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newlyCreatedKey.accessKeyId)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
              <div>
                <Label className="text-yellow-900">Secret Key</Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    value={newlyCreatedKey.secretKey}
                    readOnly
                    type="password"
                    className="bg-white font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyToClipboard(newlyCreatedKey.secretKey)}
                  >
                    Copy
                  </Button>
                </div>
              </div>
            </div>
            <Button
              className="mt-4"
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
          <div className="mb-6 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Create New API Key</h3>
            {error && (
              <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
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
                <Button type="submit" disabled={createApiKey.isPending}>
                  {createApiKey.isPending ? "Creating..." : "Create API Key"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
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
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">No API keys found.</p>
            <Button onClick={() => setShowCreateForm(true)}>Create Your First API Key</Button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Your API Keys</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manage your API keys for accessing your blogs programmatically
              </p>
            </div>
            <div className="divide-y divide-gray-200">
              {apiKeys.map((key: any) => (
                <div key={key.id} className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium text-gray-900">{key.name}</h3>
                      <div className="mt-2 space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">Access Key ID:</span>
                          <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                            {key.accessKeyId}
                          </code>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(key.accessKeyId)}
                          >
                            Copy
                          </Button>
                        </div>
                        <div className="text-sm text-gray-500">
                          Created: {new Date(key.createdAt).toLocaleDateString()}
                        </div>
                        {key.lastUsed && (
                          <div className="text-sm text-gray-500">
                            Last used: {new Date(key.lastUsed).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              key.isActive
                                ? "bg-green-100 text-green-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {key.isActive ? "Active" : "Inactive"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleDelete(key.accessKeyId)}
                      className="text-red-600 hover:text-red-700"
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
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">How to Use API Keys</h3>
          <div className="space-y-3 text-sm text-blue-800">
            <p>
              Include these headers in your API requests to authenticate:
            </p>
            <div className="bg-blue-100 rounded p-3 font-mono text-xs">
              <div>x-access-key-id: your_access_key_id</div>
              <div>x-secret-key: your_secret_key</div>
            </div>
            <p className="mt-3">
              Example using curl:
            </p>
            <div className="bg-blue-100 rounded p-3 font-mono text-xs">
              curl -H &quot;x-access-key-id: your_key&quot; \<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H &quot;x-secret-key: your_secret&quot; \<br />
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;http://localhost:5005/api/v1/blogs
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


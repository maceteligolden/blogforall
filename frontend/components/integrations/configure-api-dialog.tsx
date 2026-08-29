"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useCreateApiKey } from "@/lib/hooks/use-api-key";
import { useAuthStore } from "@/lib/store/auth.store";
import { ApiCredentialRow } from "./api-credential-row";

type CreatedKey = {
  accessKeyId: string;
  secretKey: string;
  sitePublicId: string;
};

function apiErrorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : "Failed to create API key")
  );
}

export function ConfigureApiDialog({
  isOpen,
  onClose,
  onOpenGuides,
}: {
  isOpen: boolean;
  onClose: () => void;
  onOpenGuides?: () => void;
}) {
  const router = useRouter();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const createApiKey = useCreateApiKey(currentSiteId ?? undefined);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [created, setCreated] = useState<CreatedKey | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setError("");
      setCreated(null);
    }
  }, [isOpen]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!currentSiteId) {
      setError("Select a workspace in the header first.");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      const response = await createApiKey.mutateAsync({ name: name.trim() });
      const keyData = response.data.data;
      setCreated({
        accessKeyId: keyData.accessKeyId,
        secretKey: keyData.secretKey,
        sitePublicId: keyData.sitePublicId,
      });
    } catch (err: unknown) {
      setError(apiErrorMessage(err));
    }
  };

  const copy = (value: string) => {
    void navigator.clipboard.writeText(value);
  };

  const openGuides = () => {
    onClose();
    if (onOpenGuides) {
      onOpenGuides();
      return;
    }
    router.push("/dashboard/integrations/api?tab=guides");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={created ? "Save these credentials" : "Create an API key"} size="md">
      {created ? (
        <div className="space-y-4">
          <p className="text-sm text-amber-200">
            Copy the secret now and store it in your server environment. Anyone with these values can read this
            workspace’s published posts.
          </p>
          <ApiCredentialRow
            label="Workspace public ID"
            value={created.sitePublicId}
            onCopy={() => copy(created.sitePublicId)}
          />
          <ApiCredentialRow
            label="Access Key ID"
            value={created.accessKeyId}
            onCopy={() => copy(created.accessKeyId)}
          />
          <ApiCredentialRow
            label="Secret Key"
            value={created.secretKey}
            onCopy={() => copy(created.secretKey)}
            obscure
          />
          <div className="flex flex-wrap justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              onClick={onClose}
            >
              Done
            </Button>
            <Button type="button" className="bg-primary text-white hover:bg-primary/90" onClick={openGuides}>
              Open guides
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleCreate} className="space-y-4">
          <p className="text-sm text-gray-400">
            Keys are scoped to this workspace. Use them from your server to fetch published posts.
          </p>
          {error ? (
            <div className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{error}</div>
          ) : null}
          <div>
            <Label htmlFor="api-key-name">Key name</Label>
            <Input
              id="api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Production"
              className="mt-1 border-gray-700 bg-black text-white"
              maxLength={100}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 bg-gray-800 text-gray-200 hover:bg-gray-700 hover:text-white"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="bg-primary text-white hover:bg-primary/90"
              disabled={createApiKey.isPending}
            >
              {createApiKey.isPending ? "Creating…" : "Create API key"}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

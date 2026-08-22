"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteService, CreateSiteRequest } from "@/lib/api/services/site.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";
import { persistFirstPostWritingRequest } from "@/lib/writing/use-start-writing-thread";

interface CreateSiteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSiteDialog({ isOpen, onClose }: CreateSiteDialogProps) {
  const [name, setName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { updateSiteContext } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const createSiteMutation = useMutation({
    mutationFn: (data: CreateSiteRequest) => SiteService.createSite(data),
    onSuccess: async (newSite) => {
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      updateSiteContext(newSite._id);
      setName("");
      setWebsiteUrl("");
      setError("");
      onClose();
      persistFirstPostWritingRequest();
      toast({
        variant: "success",
        title: "Workspace ready",
        description:
          "We're generating Content Strategy from your website. Chat can help you refine it when it's ready.",
      });
      router.push("/dashboard");
    },
    onError: (err: unknown) => {
      const apiMessage = (err as { response?: { data?: { message?: string } }; code?: string; message?: string })
        ?.response?.data?.message;
      const message =
        apiMessage ||
        ((err as { code?: string; message?: string })?.code === "ECONNREFUSED" ||
        (err as { message?: string })?.message?.includes("Network")
          ? "Cannot reach server. Please check that the backend is running."
          : "Failed to create workspace");
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Workspace name is required");
      return;
    }
    if (!websiteUrl.trim()) {
      setError("Website URL is required");
      return;
    }

    createSiteMutation.mutate({
      name: name.trim(),
      website_url: websiteUrl.trim(),
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create workspace"
      size="md"
      footer={
        <div className="flex justify-end space-x-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={createSiteMutation.isPending}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={createSiteMutation.isPending || !name.trim() || !websiteUrl.trim()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {createSiteMutation.isPending ? "Creating..." : "Create workspace"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">{error}</div>
        )}

        <div>
          <Label htmlFor="workspace-name" className="text-gray-300">
            Workspace name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="workspace-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Acme Content"
            className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            required
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="workspace-url" className="text-gray-300">
            Website URL <span className="text-red-400">*</span>
          </Label>
          <Input
            id="workspace-url"
            type="url"
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            required
          />
          <p className="mt-2 text-xs text-gray-500">
            We will generate Content Strategy from this website in the background.
          </p>
        </div>
      </form>
    </Modal>
  );
}

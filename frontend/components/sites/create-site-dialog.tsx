"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SiteService, CreateSiteRequest } from "@/lib/api/services/site.service";
import { useAuth } from "@/lib/hooks/use-auth";
import { QUERY_KEYS } from "@/lib/api/config";

interface CreateSiteDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateSiteDialog({ isOpen, onClose }: CreateSiteDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const queryClient = useQueryClient();
  const { updateSiteContext } = useAuth();

  const createSiteMutation = useMutation({
    mutationFn: (data: CreateSiteRequest) => SiteService.createSite(data),
    onSuccess: async (newSite) => {
      // Invalidate sites query to refetch
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SITES });
      
      // Switch to the new site
      updateSiteContext(newSite._id);
      
      // Reset form and close
      setName("");
      setDescription("");
      setError("");
      onClose();
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to create site";
      setError(message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Site name is required");
      return;
    }

    createSiteMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create New Site"
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
            disabled={createSiteMutation.isPending || !name.trim()}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            {createSiteMutation.isPending ? "Creating..." : "Create Site"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-md bg-red-900/50 border border-red-800 p-3 text-sm text-red-200">
            {error}
          </div>
        )}

        <div>
          <Label htmlFor="site-name" className="text-gray-300">
            Site Name <span className="text-red-400">*</span>
          </Label>
          <Input
            id="site-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Blog Site"
            className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            required
            autoFocus
          />
        </div>

        <div>
          <Label htmlFor="site-description" className="text-gray-300">
            Description (Optional)
          </Label>
          <textarea
            id="site-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="A brief description of your site"
            rows={4}
            className="mt-1 flex w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
      </form>
    </Modal>
  );
}

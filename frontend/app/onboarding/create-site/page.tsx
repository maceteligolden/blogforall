"use client";

import { useState } from "react";
import { useCreateSiteMutations } from "@/lib/hooks/use-create-site-mutations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProtectedRoute } from "@/components/protected-route";

export default function CreateSitePage() {
  const [name, setName] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [error, setError] = useState<string>("");

  const { skipMutation, createSiteMutation } = useCreateSiteMutations({ onError: setError });

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
    <ProtectedRoute>
      <div className="min-h-screen bg-black text-white">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              Create Your First Site
            </h1>
            <p className="text-xl text-gray-400">
              Get started by creating a site to organize your blogs
            </p>
          </div>

          <div className="bg-gray-900 rounded-xl border border-gray-800 p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
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
                <p className="mt-1 text-xs text-gray-400">
                  Choose a name for your site. You can change this later.
                </p>
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

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => skipMutation.mutate()}
                  disabled={skipMutation.isPending}
                  className="border-gray-700 text-gray-300 hover:bg-gray-800"
                >
                  {skipMutation.isPending ? "Skipping..." : "Skip for now"}
                </Button>
                <Button
                  type="submit"
                  disabled={createSiteMutation.isPending || !name.trim()}
                  className="bg-primary hover:bg-primary/90 text-white px-8"
                >
                  {createSiteMutation.isPending ? "Creating..." : "Create workspace"}
                </Button>
              </div>
            </form>
          </div>

          <div className="mt-8 text-center">
            <p className="text-sm text-gray-400">
              You can create additional workspaces later from the dashboard
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

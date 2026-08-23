"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { IntegrationService, type FramerCollection } from "@/lib/api/services/integration.service";
import { useToast } from "@/components/ui/toast";

const REQUIRED_FIELDS = ["title", "content"] as const;
const OPTIONAL_FIELDS = ["slug", "excerpt", "featured_image", "published_at"] as const;
const FIELD_LABELS: Record<string, string> = {
  title: "Title",
  content: "Content",
  slug: "Slug",
  excerpt: "Excerpt",
  featured_image: "Featured image",
  published_at: "Published at",
};

export default function ConfigureFramerPage() {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectUrl, setProjectUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [collections, setCollections] = useState<FramerCollection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const selected = collections.find((collection) => collection.id === collectionId);
  const canSave = REQUIRED_FIELDS.every((field) => Boolean(fieldMap[field]));

  const fieldOptions = useMemo(
    () =>
      (selected?.fields ?? []).map((field) => ({
        id: field.id,
        label: `${field.name} (${field.type})`,
      })),
    [selected]
  );

  const testMutation = useMutation({
    mutationFn: () => IntegrationService.testFramer(currentSiteId as string, { projectUrl, apiKey }),
    onSuccess: (data) => {
      setCollections(data.collections ?? []);
      setCollectionId(data.collections?.[0]?.id ?? "");
      setFieldMap({});
      setError(null);
      setStep(2);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "Could not connect to Framer. Check the project URL and API key.");
    },
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      IntegrationService.saveFramer(currentSiteId as string, {
        projectUrl,
        apiKey,
        collectionId,
        collectionName: selected?.name ?? collectionId,
        fieldMap,
        autoDeploy: true,
      }),
    onSuccess: async () => {
      if (currentSiteId) {
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATIONS(currentSiteId) });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FRAMER_INTEGRATION(currentSiteId) });
        await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INTEGRATION_DESTINATIONS(currentSiteId) });
      }
      toast({ variant: "success", description: "Framer is connected." });
      router.push("/dashboard/integrations/framer");
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(message ?? "Could not save the Framer connection.");
    },
  });

  if (!currentSiteId) {
    return <p className="p-6 text-gray-400">Select a workspace first.</p>;
  }

  return (
    <div className="p-4 lg:p-6 max-w-3xl">
      <Breadcrumb
        items={[
          { label: "Integrations", href: "/dashboard/integrations" },
          { label: "Framer" },
          { label: "Configure" },
        ]}
      />
      <h1 className="text-2xl font-display text-white mb-2">Connect Framer</h1>
      <p className="text-sm text-gray-400 mb-6">
        Generate an API key in Framer Site Settings → General, then map your blog CMS collection. Use the
        editor URL from the address bar (it includes <span className="text-gray-300">/projects/</span>), not
        the published site link.
      </p>

      {error && (
        <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <div>
            <Label htmlFor="projectUrl">Project URL</Label>
            <Input
              id="projectUrl"
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="https://framer.com/projects/My-Site--xxxxxxxxxxxxxxxxxxxx"
              value={projectUrl}
              onChange={(e) => setProjectUrl(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Open the project in Framer and copy the browser URL. IDs look like 20 letters/numbers after --.
            </p>
          </div>
          <div>
            <Label htmlFor="apiKey">API key</Label>
            <Input
              id="apiKey"
              type="password"
              className="mt-1 bg-black border-gray-700 text-white"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
            />
          </div>
          <Button
            onClick={() => testMutation.mutate()}
            disabled={!projectUrl || !apiKey || testMutation.isPending}
            className="bg-primary text-white hover:bg-primary/90"
          >
            {testMutation.isPending ? "Testing…" : "Continue"}
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <Label htmlFor="collection">CMS collection</Label>
          <select
            id="collection"
            className="mt-1 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
            value={collectionId}
            onChange={(e) => {
              setCollectionId(e.target.value);
              setFieldMap({});
            }}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(1)} className="border-gray-700 text-gray-200">
              Back
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={!collectionId}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-5">
          <p className="text-sm text-gray-300">
            Map Bloggr fields to Framer collection fields. Title and content are required.
          </p>
          {[...REQUIRED_FIELDS, ...OPTIONAL_FIELDS].map((field) => (
            <div key={field}>
              <Label htmlFor={`map-${field}`}>
                {FIELD_LABELS[field]}
                {REQUIRED_FIELDS.includes(field as (typeof REQUIRED_FIELDS)[number]) ? " *" : " (optional)"}
              </Label>
              <select
                id={`map-${field}`}
                className="mt-1 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                value={fieldMap[field] ?? ""}
                onChange={(e) => setFieldMap((prev) => ({ ...prev, [field]: e.target.value }))}
              >
                <option value="">Skip</option>
                {fieldOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep(2)} className="border-gray-700 text-gray-200">
              Back
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!canSave || saveMutation.isPending}
              className="bg-primary text-white hover:bg-primary/90"
            >
              {saveMutation.isPending ? "Saving…" : "Save connection"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

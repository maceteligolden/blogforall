"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { IntegrationService, type FramerCollection } from "@/lib/api/services/integration.service";
import { suggestFramerFieldMap } from "./framer-field-map";

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

const STEP_LABELS = ["Credentials", "Collection", "Field map"] as const;
const SUCCESS_HIDE_MS = 2000;
const EDITOR_URL_EXAMPLE = "https://framer.com/projects/Alive-Eyes--ciftteW00GGfesoI7YBa";

type SetupError = {
  title: string;
  explanation: string;
  example?: string;
};

function apiErrorMessage(err: unknown): string {
  return (
    (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
    (err instanceof Error ? err.message : "")
  );
}

export function formatFramerSetupError(err: unknown): SetupError {
  const message = apiErrorMessage(err);
  const lower = message.toLowerCase();

  if (
    lower.includes("project url") ||
    lower.includes("editor address") ||
    lower.includes("framer.app") ||
    lower.includes("invalid framer") ||
    lower.includes("invalid project")
  ) {
    return {
      title: "Invalid project URL",
      explanation: "Use the editor URL from the address bar, not the published site.",
      example: EDITOR_URL_EXAMPLE,
    };
  }

  if (
    lower.includes("api key") ||
    lower.includes("unauthorized") ||
    lower.includes("forbidden") ||
    lower.includes("could not connect")
  ) {
    return {
      title: "Could not connect",
      explanation: "Generate a key in Framer Site Settings → General, then paste it here.",
      example: "ap_…",
    };
  }

  if (lower.includes("field map") || lower.includes("title and content") || lower.includes("must be mapped")) {
    return {
      title: "Field mapping incomplete",
      explanation: message || "Title and content must be mapped to Framer fields.",
    };
  }

  if (message) {
    return {
      title: "Could not connect to Framer",
      explanation: message,
      example: EDITOR_URL_EXAMPLE,
    };
  }

  return {
    title: "Could not connect to Framer",
    explanation: "Check the project URL and API key, then try again.",
    example: EDITOR_URL_EXAMPLE,
  };
}

function FramerErrorBanner({ error }: { error: SetupError }) {
  return (
    <div className="mb-4 rounded-md border border-red-800 bg-red-900/30 px-3 py-3 text-sm text-red-100">
      <p className="font-semibold">{error.title}</p>
      <p className="mt-1 text-red-200">{error.explanation}</p>
      {error.example && (
        <p className="mt-2 text-xs text-red-300/90">
          Example: <code className="break-all rounded bg-black/40 px-1 py-0.5 text-red-100">{error.example}</code>
        </p>
      )}
    </div>
  );
}

interface ConfigureFramerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  stacked?: boolean;
}

export function ConfigureFramerDialog({ isOpen, onClose, stacked = false }: ConfigureFramerDialogProps) {
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [projectUrl, setProjectUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [collections, setCollections] = useState<FramerCollection[]>([]);
  const [collectionId, setCollectionId] = useState("");
  const [fieldMap, setFieldMap] = useState<Record<string, string>>({});
  const [error, setError] = useState<SetupError | null>(null);
  const [succeeded, setSucceeded] = useState(false);

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

  useEffect(() => {
    if (isOpen) return;
    setStep(1);
    setProjectUrl("");
    setApiKey("");
    setCollections([]);
    setCollectionId("");
    setFieldMap({});
    setError(null);
    setSucceeded(false);
  }, [isOpen]);

  useEffect(() => {
    if (!succeeded) return;
    const timer = window.setTimeout(() => {
      onClose();
    }, SUCCESS_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [succeeded, onClose]);

  const applyCollections = (next: FramerCollection[], advance: boolean) => {
    setCollections(next);
    const keepCurrent = next.some((collection) => collection.id === collectionId);
    const nextCollectionId = keepCurrent ? collectionId : (next[0]?.id ?? "");
    const nextCollection = next.find((collection) => collection.id === nextCollectionId);
    if (keepCurrent) {
      setCollectionId(collectionId);
      if (nextCollection) {
        setFieldMap((prev) => suggestFramerFieldMap(nextCollection.fields, prev));
      }
    } else {
      setCollectionId(nextCollectionId);
      setFieldMap(nextCollection ? suggestFramerFieldMap(nextCollection.fields) : {});
    }
    setError(null);
    if (advance) setStep(2);
  };

  const testMutation = useMutation({
    mutationFn: () => IntegrationService.testFramer(currentSiteId as string, { projectUrl, apiKey }),
    onSuccess: (data) => {
      applyCollections(data.collections ?? [], true);
    },
    onError: (err: unknown) => {
      setError(formatFramerSetupError(err));
    },
  });

  const refreshMutation = useMutation({
    mutationFn: () => IntegrationService.testFramer(currentSiteId as string, { projectUrl, apiKey }),
    onSuccess: (data) => {
      applyCollections(data.collections ?? [], false);
    },
    onError: (err: unknown) => {
      setError(formatFramerSetupError(err));
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
      setError(null);
      setSucceeded(true);
    },
    onError: (err: unknown) => {
      setError(formatFramerSetupError(err));
    },
  });

  const handleClose = () => {
    if (saveMutation.isPending) return;
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Connect Framer" size="lg" stacked={stacked}>
      {succeeded ? (
        <div className="flex flex-col items-center justify-center py-12 text-center animate-in zoom-in-95 fade-in duration-300">
          <CheckCircle2 className="h-14 w-14 text-green-400" aria-hidden="true" />
          <p className="mt-4 text-lg font-semibold text-white">Framer is connected</p>
          <p className="mt-1 text-sm text-gray-400">You can publish posts to this collection.</p>
        </div>
      ) : (
        <>
          <ol className="mb-5 flex gap-2" aria-label="Setup steps">
            {STEP_LABELS.map((label, index) => {
              const n = (index + 1) as 1 | 2 | 3;
              const active = step === n;
              const done = step > n;
              return (
                <li
                  key={label}
                  className={`flex-1 rounded-md border px-2 py-1.5 text-center text-xs ${
                    active
                      ? "border-primary bg-primary/10 text-white"
                      : done
                        ? "border-gray-700 text-gray-300"
                        : "border-gray-800 text-gray-500"
                  }`}
                >
                  {n}. {label}
                </li>
              );
            })}
          </ol>

          {error && <FramerErrorBanner error={error} />}

          {!currentSiteId ? (
            <p className="text-sm text-gray-400">Select a workspace first.</p>
          ) : step === 1 ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-400">
                Generate an API key in Framer Site Settings → General. Use the editor URL from the address bar (it
                includes <span className="text-gray-300">/projects/</span>), not the published site link.
              </p>
              <div>
                <Label htmlFor="projectUrl">Project URL</Label>
                <Input
                  id="projectUrl"
                  className="mt-1 bg-black border-gray-700 text-white"
                  placeholder={EDITOR_URL_EXAMPLE}
                  value={projectUrl}
                  onChange={(e) => setProjectUrl(e.target.value)}
                />
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
              <div className="flex justify-end">
                <Button
                  onClick={() => testMutation.mutate()}
                  disabled={!projectUrl || !apiKey || testMutation.isPending}
                  className="bg-primary text-white hover:bg-primary/90"
                >
                  {testMutation.isPending ? "Testing…" : "Continue"}
                </Button>
              </div>
            </div>
          ) : step === 2 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="collection">CMS collection</Label>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => refreshMutation.mutate()}
                  disabled={refreshMutation.isPending || !projectUrl || !apiKey}
                  className="h-8 border-gray-700 text-gray-200"
                >
                  <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshMutation.isPending ? "animate-spin" : ""}`} />
                  {refreshMutation.isPending ? "Refreshing…" : "Refresh"}
                </Button>
              </div>
              {collections.length === 0 ? (
                <p className="text-sm text-gray-400">
                  No CMS collections found — add a collection in Framer, then Refresh.
                </p>
              ) : (
                <select
                  id="collection"
                  className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                  value={collectionId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    const nextCollection = collections.find((collection) => collection.id === nextId);
                    setCollectionId(nextId);
                    setFieldMap(nextCollection ? suggestFramerFieldMap(nextCollection.fields) : {});
                  }}
                >
                  {collections.map((collection) => (
                    <option key={collection.id} value={collection.id}>
                      {collection.name}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex justify-end gap-2">
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
          ) : (
            <div className="space-y-4">
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
              <div className="flex justify-end gap-2">
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
        </>
      )}
    </Modal>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Globe, Plus, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  MemoryService,
  type BusinessModel,
  type CompetitorEntry,
  type CustomerPersona,
  type WorkspaceMemoryResponse,
  type WorkspaceStrategic,
} from "@/lib/api/services/memory.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { BUSINESS_REFINE_PROMPT_KEY } from "@/lib/onboarding/brand-setup-items";

const BUSINESS_MODELS: { value: BusinessModel; label: string }[] = [
  { value: "b2b", label: "B2B" },
  { value: "b2c", label: "B2C" },
  { value: "c2c", label: "C2C" },
  { value: "b2b2c", label: "B2B2C" },
];

const AI_PROMPTS: Record<string, string> = {
  overview:
    "Help me improve my business overview — industries, business model (B2B/B2C/C2C/B2B2C), and a clear paragraph description of what we do.",
  customers:
    "Help me refine our customer personas — who they are, the pain points we solve, and what success looks like. Keep short audience labels too.",
  brand: "Help me write a descriptive brand voice and list brand negatives (words, tones, or claims to avoid).",
  competitors: "Help me identify and describe our main competitors and how we differ from each.",
  goals: "Help me clarify business goals, SEO priorities, and publishing channels for content.",
};

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function emptyPersona(): CustomerPersona {
  return { who: "", pain_points: "", success: "", label: "" };
}

function emptyCompetitor(): CompetitorEntry {
  return { name: "", notes: "" };
}

function SectionCard({
  title,
  description,
  aiKey,
  onImprove,
  children,
}: {
  title: string;
  description: string;
  aiKey: keyof typeof AI_PROMPTS;
  onImprove: (key: keyof typeof AI_PROMPTS) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm text-gray-400">{description}</p>
        </div>
        <Button
          type="button"
          variant="outline"
          className="border-gray-700 text-gray-200 hover:bg-gray-800"
          onClick={() => onImprove(aiKey)}
        >
          <Sparkles className="mr-2 h-4 w-4" />
          Improve with AI
        </Button>
      </div>
      {children}
    </section>
  );
}

export function BusinessProfileForm() {
  const router = useRouter();
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [industries, setIndustries] = useState("");
  const [businessModel, setBusinessModel] = useState<BusinessModel | "">("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [audienceLabels, setAudienceLabels] = useState("");
  const [customers, setCustomers] = useState<CustomerPersona[]>([emptyPersona()]);
  const [brandVoice, setBrandVoice] = useState("");
  const [brandNegatives, setBrandNegatives] = useState("");
  const [tone, setTone] = useState("");
  const [competitors, setCompetitors] = useState<CompetitorEntry[]>([emptyCompetitor()]);
  const [goals, setGoals] = useState("");
  const [seo, setSeo] = useState("");
  const [channels, setChannels] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [fillMessage, setFillMessage] = useState<string | null>(null);
  const [fillError, setFillError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.WORKSPACE_MEMORY(currentSiteId) : [],
    queryFn: () => MemoryService.getMemory(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const applyMemoryToForm = (memory: WorkspaceMemoryResponse) => {
    const s = memory.strategic;
    setWebsiteUrl(s.website_url || "");
    setIndustries((s.industries ?? []).join(", "));
    setBusinessModel(s.business_model ?? "");
    setBusinessDescription(s.business_description || s.business_type || "");
    setAudienceLabels((s.target_audience ?? []).join(", "));
    setCustomers(
      s.customers?.length
        ? s.customers.map((c) => ({
            who: c.who || "",
            pain_points: c.pain_points || "",
            success: c.success || "",
            label: c.label || "",
          }))
        : [emptyPersona()]
    );
    setBrandVoice(s.brand_voice || "");
    setBrandNegatives(s.brand_negatives || "");
    setTone(memory.preferences.tone || "");
    setCompetitors(
      s.competitors?.length
        ? s.competitors.map((c) => ({ name: c.name || "", notes: c.notes || "" }))
        : s.competitive_notes
          ? [{ name: "Notes", notes: s.competitive_notes }]
          : [emptyCompetitor()]
    );
    setGoals((s.business_goals ?? []).join(", "));
    setSeo((s.seo_priorities ?? []).join(", "));
    setChannels((s.publishing_channels ?? []).join(", "));
  };

  useEffect(() => {
    if (!data || hydrated) return;
    applyMemoryToForm(data);
    setHydrated(true);
  }, [data, hydrated]);

  const fillFromWebsiteMutation = useMutation({
    mutationFn: () => {
      const url = websiteUrl.trim() || data?.strategic.website_url?.trim() || "";
      if (!url) {
        throw new Error("Enter a website URL to fill business information.");
      }
      return MemoryService.fillFromWebsite(currentSiteId as string, url);
    },
    onSuccess: (result) => {
      applyMemoryToForm(result);
      setWebsiteUrl(result.website_url || result.strategic.website_url || websiteUrl);
      queryClient.setQueryData(QUERY_KEYS.WORKSPACE_MEMORY(currentSiteId as string), result);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKSPACE_MEMORY(currentSiteId as string) });
      setFillError(null);
      setFillMessage("Business information filled from the website. Review and save any edits.");
      setTimeout(() => setFillMessage(null), 5000);
    },
    onError: (err: unknown) => {
      const message =
        (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message ||
        (err as Error)?.message ||
        "Could not fill from website. Try another URL or edit fields manually.";
      setFillMessage(null);
      setFillError(message);
    },
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const strategic: Partial<WorkspaceStrategic> = {
        website_url: websiteUrl.trim() || data?.strategic.website_url,
        industries: splitCsv(industries),
        business_model: businessModel || undefined,
        business_description: businessDescription.trim() || undefined,
        target_audience: splitCsv(audienceLabels),
        customers: customers
          .map((c) => ({
            who: c.who.trim(),
            pain_points: c.pain_points?.trim() || undefined,
            success: c.success?.trim() || undefined,
            label: c.label?.trim() || undefined,
          }))
          .filter((c) => c.who),
        brand_voice: brandVoice.trim() || undefined,
        brand_negatives: brandNegatives.trim() || undefined,
        business_goals: splitCsv(goals),
        seo_priorities: splitCsv(seo),
        publishing_channels: splitCsv(channels),
        competitors: competitors
          .map((c) => ({
            name: c.name.trim(),
            notes: c.notes?.trim() || undefined,
          }))
          .filter((c) => c.name),
      };
      return MemoryService.updateMemory(currentSiteId as string, {
        strategic: strategic as WorkspaceStrategic,
        preferences: { ...data?.preferences, tone: tone.trim() || undefined },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKSPACE_MEMORY(currentSiteId as string) });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  const improveWithAi = (key: keyof typeof AI_PROMPTS) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem(BUSINESS_REFINE_PROMPT_KEY, AI_PROMPTS[key]);
    }
    router.push("/dashboard");
  };

  if (!currentSiteId) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="mb-4 text-gray-400">Choose a workspace to view business data.</p>
        <Link href="/dashboard/sites" className="text-primary hover:underline">
          View workspaces
        </Link>
      </div>
    );
  }

  if (isLoading || !data || !hydrated) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-gray-400">Loading business data…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {saveSuccess && (
        <div className="rounded-md border border-green-800 bg-green-900/20 p-3 text-sm text-green-400">
          Business data saved.
        </div>
      )}
      {fillMessage && (
        <div className="rounded-md border border-green-800 bg-green-900/20 p-3 text-sm text-green-400">
          {fillMessage}
        </div>
      )}
      {fillError && (
        <div className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">{fillError}</div>
      )}
      {saveMutation.isError && (
        <div className="rounded-md border border-red-800 bg-red-900/20 p-3 text-sm text-red-400">
          Could not save business data. Try again.
        </div>
      )}

      <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Fill from website</h2>
          <p className="mt-1 text-sm text-gray-400">
            {websiteUrl.trim() || data.strategic.website_url
              ? "Use your workspace website to extract and fill business information below."
              : "Add a website URL so we can extract and fill business information for this workspace."}
          </p>
        </div>
        <div>
          <Label className="text-gray-300">Website URL</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={websiteUrl}
            onChange={(e) => {
              setWebsiteUrl(e.target.value);
              setFillError(null);
            }}
            placeholder="https://example.com"
          />
        </div>
        <Button
          type="button"
          onClick={() => fillFromWebsiteMutation.mutate()}
          disabled={fillFromWebsiteMutation.isPending || !(websiteUrl.trim() || data.strategic.website_url)}
          className="bg-primary text-white hover:bg-primary/90"
        >
          <Globe className="mr-2 h-4 w-4" />
          {fillFromWebsiteMutation.isPending ? "Reading website…" : "Fill business info from website"}
        </Button>
        {!(websiteUrl.trim() || data.strategic.website_url) && (
          <p className="text-xs text-amber-400/90">Enter a URL above to enable filling from the website.</p>
        )}
      </section>

      <SectionCard
        title="Overview"
        description="Industries, model, and a paragraph description of the business."
        aiKey="overview"
        onImprove={improveWithAi}
      >
        <div>
          <Label className="text-gray-300">Industries (comma-separated)</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={industries}
            onChange={(e) => setIndustries(e.target.value)}
            placeholder="e.g. SaaS, fintech, healthcare"
          />
        </div>
        <div>
          <Label className="text-gray-300">Business model</Label>
          <select
            className="mt-1 w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
            value={businessModel}
            onChange={(e) => setBusinessModel(e.target.value as BusinessModel | "")}
          >
            <option value="">Select…</option>
            {BUSINESS_MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label className="text-gray-300">Business description</Label>
          <Textarea
            className="mt-1 min-h-[120px] border-gray-700 bg-gray-800"
            value={businessDescription}
            onChange={(e) => setBusinessDescription(e.target.value)}
            placeholder="Describe what the business does in paragraph form — not a bullet list."
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Customers"
        description="Personas with who they are, pains you solve, and what success looks like."
        aiKey="customers"
        onImprove={improveWithAi}
      >
        <div>
          <Label className="text-gray-300">Audience labels (comma-separated)</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={audienceLabels}
            onChange={(e) => setAudienceLabels(e.target.value)}
            placeholder="e.g. startup founders, marketing managers"
          />
        </div>
        <div className="space-y-4">
          {customers.map((persona, index) => (
            <div key={index} className="rounded-md border border-gray-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-300">Persona {index + 1}</span>
                {customers.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-gray-400 hover:text-red-400"
                    onClick={() => setCustomers((prev) => prev.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <div>
                <Label className="text-gray-400">Short label</Label>
                <Input
                  className="mt-1 border-gray-700 bg-gray-800"
                  value={persona.label || ""}
                  onChange={(e) =>
                    setCustomers((prev) => prev.map((c, i) => (i === index ? { ...c, label: e.target.value } : c)))
                  }
                  placeholder="Optional tag"
                />
              </div>
              <div>
                <Label className="text-gray-400">Who they are</Label>
                <Textarea
                  className="mt-1 min-h-[72px] border-gray-700 bg-gray-800"
                  value={persona.who}
                  onChange={(e) =>
                    setCustomers((prev) => prev.map((c, i) => (i === index ? { ...c, who: e.target.value } : c)))
                  }
                  placeholder="Describe this customer in a paragraph."
                />
              </div>
              <div>
                <Label className="text-gray-400">Pain points we solve</Label>
                <Textarea
                  className="mt-1 min-h-[72px] border-gray-700 bg-gray-800"
                  value={persona.pain_points || ""}
                  onChange={(e) =>
                    setCustomers((prev) =>
                      prev.map((c, i) => (i === index ? { ...c, pain_points: e.target.value } : c))
                    )
                  }
                />
              </div>
              <div>
                <Label className="text-gray-400">What success looks like</Label>
                <Textarea
                  className="mt-1 min-h-[72px] border-gray-700 bg-gray-800"
                  value={persona.success || ""}
                  onChange={(e) =>
                    setCustomers((prev) => prev.map((c, i) => (i === index ? { ...c, success: e.target.value } : c)))
                  }
                />
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="border-gray-700"
            onClick={() => setCustomers((prev) => [...prev, emptyPersona()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add persona
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Brand"
        description="Descriptive voice, avoidances, and draft tone preference."
        aiKey="brand"
        onImprove={improveWithAi}
      >
        <div>
          <Label className="text-gray-300">Brand voice</Label>
          <Textarea
            className="mt-1 min-h-[100px] border-gray-700 bg-gray-800"
            value={brandVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="Describe how the brand should sound — personality, cadence, vocabulary."
          />
        </div>
        <div>
          <Label className="text-gray-300">Brand negatives (avoid)</Label>
          <Textarea
            className="mt-1 min-h-[80px] border-gray-700 bg-gray-800"
            value={brandNegatives}
            onChange={(e) => setBrandNegatives(e.target.value)}
            placeholder="Words, tones, or claims the brand should never use."
          />
        </div>
        <div>
          <Label className="text-gray-300">Draft tone</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. conversational, expert"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Competitors"
        description="Named competitors and how you differ."
        aiKey="competitors"
        onImprove={improveWithAi}
      >
        <div className="space-y-3">
          {competitors.map((comp, index) => (
            <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-start">
              <Input
                className="border-gray-700 bg-gray-800 sm:w-1/3"
                value={comp.name}
                onChange={(e) =>
                  setCompetitors((prev) => prev.map((c, i) => (i === index ? { ...c, name: e.target.value } : c)))
                }
                placeholder="Name"
              />
              <Input
                className="border-gray-700 bg-gray-800 flex-1"
                value={comp.notes || ""}
                onChange={(e) =>
                  setCompetitors((prev) => prev.map((c, i) => (i === index ? { ...c, notes: e.target.value } : c)))
                }
                placeholder="How you differ (optional)"
              />
              {competitors.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-red-400"
                  onClick={() => setCompetitors((prev) => prev.filter((_, i) => i !== index))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            className="border-gray-700"
            onClick={() => setCompetitors((prev) => [...prev, emptyCompetitor()])}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add competitor
          </Button>
        </div>
      </SectionCard>

      <SectionCard
        title="Goals & channels"
        description="Content goals, SEO priorities, and where you publish."
        aiKey="goals"
        onImprove={improveWithAi}
      >
        <div>
          <Label className="text-gray-300">Business goals (comma-separated)</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="e.g. drive signups, build thought leadership"
          />
        </div>
        <div>
          <Label className="text-gray-300">SEO priorities (comma-separated)</Label>
          <Input className="mt-1 border-gray-700 bg-gray-800" value={seo} onChange={(e) => setSeo(e.target.value)} />
        </div>
        <div>
          <Label className="text-gray-300">Publishing channels (comma-separated)</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={channels}
            onChange={(e) => setChannels(e.target.value)}
          />
        </div>
      </SectionCard>

      {data.behavioral_rules?.length > 0 && (
        <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
          <h3 className="mb-3 text-lg font-semibold text-white">Writing rules</h3>
          <ul className="space-y-2">
            {data.behavioral_rules.map((rule) => (
              <li key={rule.rule_id} className="rounded-md border border-gray-800 px-3 py-2 text-sm">
                <span className="capitalize text-primary">{rule.polarity}</span>: {rule.rule_text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-primary text-white hover:bg-primary/90"
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="outline" className="border-gray-700" onClick={() => improveWithAi("overview")}>
          <Sparkles className="mr-2 h-4 w-4" />
          Open AI chat
        </Button>
      </div>
    </div>
  );
}

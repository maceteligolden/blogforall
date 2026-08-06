"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiPostWizardProgress } from "@/components/blog/ai-post-wizard-progress";
import { TopicSuggestionList } from "@/components/blog/topic-suggestion-list";
import { PostEnrichmentForm } from "@/components/blog/post-enrichment-form";
import { OutlinePlanEditor } from "@/components/blog/outline-plan-editor";
import { GenerationProgress, type GenerationStage } from "@/components/blog/generation-progress";
import { BlogGenerationService, type GenerateBlogResponse } from "@/lib/api/services/blog-generation.service";
import type { AiWizardStep, PostEnrichment, PostOutline, TopicSuggestion } from "@/lib/types/interactive-post";
import { useCampaigns } from "@/lib/hooks/use-campaign";
import type { Campaign } from "@/lib/api/services/campaign.service";
import { Sparkles } from "lucide-react";

type Props = {
  onComplete: (result: GenerateBlogResponse) => void;
  onError?: (message: string) => void;
};

function mapStreamStage(event: string, data: unknown): GenerationStage | null {
  if (event === "research") return "analyzing";
  if (event === "phase" && data && typeof data === "object") {
    const step = (data as { step?: string }).step;
    if (step === "research") return "analyzing";
    if (step === "outline_locked") return "analyzing";
    if (step === "draft") return "generating";
    if (step === "review") return "reviewing";
  }
  if (event === "draft_partial") return "generating";
  if (event === "final") return "reviewing";
  return null;
}

export function AiPostWizard({ onComplete, onError }: Props) {
  const { data: campaignsResponse } = useCampaigns();
  const campaigns: Campaign[] = useMemo(() => campaignsResponse?.data?.data || [], [campaignsResponse]);
  const [step, setStep] = useState<AiWizardStep>("seed");
  const [seedIntent, setSeedIntent] = useState("");
  const [campaignFilter, setCampaignFilter] = useState("");
  const [topics, setTopics] = useState<TopicSuggestion[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<TopicSuggestion | null>(null);
  const [enrichment, setEnrichment] = useState<PostEnrichment>({ length_preset: "medium" });
  const [outline, setOutline] = useState<PostOutline | null>(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingOutline, setLoadingOutline] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStage>("analyzing");
  const [abortController, setAbortController] = useState<AbortController | null>(null);
  const [error, setError] = useState("");

  const fail = (message: string) => {
    setError(message);
    onError?.(message);
  };

  const loadTopics = async () => {
    setLoadingTopics(true);
    setError("");
    setStep("topics");
    try {
      const res = await BlogGenerationService.suggestTopics({
        seed_intent: seedIntent.trim() || undefined,
        campaign_id: campaignFilter || undefined,
        count: 6,
      });
      setTopics(res.topics);
      setSelectedTopic(null);
    } catch (e) {
      fail((e as Error).message || "Could not suggest topics");
      setStep("seed");
    } finally {
      setLoadingTopics(false);
    }
  };

  const goEnrich = () => {
    if (!selectedTopic) {
      fail("Pick a topic to continue");
      return;
    }
    setStep("enrich");
  };

  const buildOutline = async () => {
    if (!selectedTopic) return;
    setLoadingOutline(true);
    setError("");
    setStep("outline");
    try {
      const plan = await BlogGenerationService.buildOutline({
        topic: selectedTopic,
        enrichment,
      });
      setOutline(plan);
    } catch (e) {
      fail((e as Error).message || "Could not build outline");
      setStep("enrich");
    } finally {
      setLoadingOutline(false);
    }
  };

  const approveAndGenerate = async () => {
    if (!selectedTopic || !outline) return;
    const ac = new AbortController();
    setAbortController(ac);
    setGenerating(true);
    setGenerationStage("analyzing");
    setStep("generate");
    setError("");
    try {
      const prompt = [
        `Write a ${selectedTopic.post_type.replace("_", "-")} blog post.`,
        `Title angle: ${outline.working_title}`,
        `Thesis: ${outline.thesis}`,
        `About: ${selectedTopic.about}`,
        enrichment.personal_notes ? `Notes: ${enrichment.personal_notes}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const analysis = {
        topic: outline.working_title,
        domain: "General",
        target_audience: enrichment.target_audience || "general audience",
        purpose: outline.thesis,
        structure: outline.sections.map((s) => s.heading).join(" → "),
        word_count: enrichment.word_count,
        tone: enrichment.tone,
        topics_to_explore: outline.keywords,
        is_valid: true,
      };

      const campaignId = outline.campaign_id || selectedTopic.campaign_id;
      const result = await BlogGenerationService.generateBlogStream(prompt, analysis, {
        signal: ac.signal,
        enrichment,
        approved_outline: outline,
        campaign_id: campaignId,
        keywords: outline.keywords,
        post_type: outline.post_type,
        onEvent: (event, data) => {
          const next = mapStreamStage(event, data);
          if (next) setGenerationStage(next);
        },
      });

      setGenerationStage("complete");
      setStep("done");
      onComplete({ ...result, campaign_id: result.campaign_id || campaignId });
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        fail("Generation cancelled");
      } else {
        fail((e as Error).message || "Generation failed");
      }
      setStep("outline");
    } finally {
      setGenerating(false);
      setAbortController(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold text-white">AI Post Generation</h3>
      </div>
      <AiPostWizardProgress step={step === "done" ? "generate" : step} />

      {error && (
        <div className="rounded-md border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-300">{error}</div>
      )}

      {step === "seed" && (
        <div className="space-y-4">
          <div>
            <Label className="text-gray-300">What do you want to write about? (optional)</Label>
            <Input
              className="mt-1 bg-black border-gray-700 text-white"
              placeholder="e.g. onboarding tips for SaaS founders"
              value={seedIntent}
              onChange={(e) => setSeedIntent(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-gray-300">Prefer a campaign (optional)</Label>
            <select
              className="mt-1 w-full rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
              value={campaignFilter}
              onChange={(e) => setCampaignFilter(e.target.value)}
            >
              <option value="">Any / evergreen</option>
              {campaigns.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <Button type="button" className="bg-primary" onClick={loadTopics} disabled={loadingTopics}>
            {loadingTopics ? "Researching…" : "Suggest topics"}
          </Button>
        </div>
      )}

      {step === "topics" && (
        <div className="space-y-4">
          <TopicSuggestionList
            topics={topics}
            selectedId={selectedTopic?.id}
            onSelect={setSelectedTopic}
            loading={loadingTopics}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("seed")}>
              Back
            </Button>
            <Button type="button" variant="outline" onClick={loadTopics} disabled={loadingTopics}>
              Surprise me
            </Button>
            <Button type="button" className="bg-primary" onClick={goEnrich} disabled={!selectedTopic}>
              Continue
            </Button>
          </div>
        </div>
      )}

      {step === "enrich" && selectedTopic && (
        <div className="space-y-4">
          <div className="rounded-md border border-gray-800 bg-gray-950/50 p-3 text-sm text-gray-300">
            Selected: <span className="text-white font-medium">{selectedTopic.title}</span>
          </div>
          <PostEnrichmentForm value={enrichment} onChange={setEnrichment} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("topics")}>
              Back
            </Button>
            <Button type="button" className="bg-primary" onClick={buildOutline} disabled={loadingOutline}>
              {loadingOutline ? "Building plan…" : "Research & plan"}
            </Button>
          </div>
        </div>
      )}

      {step === "outline" && (
        <div className="space-y-4">
          {loadingOutline || !outline ? (
            <div className="rounded-lg border border-gray-800 p-8 text-center text-gray-400">
              Researching and drafting your post plan…
            </div>
          ) : (
            <OutlinePlanEditor outline={outline} onChange={setOutline} />
          )}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => setStep("enrich")} disabled={loadingOutline}>
              Back
            </Button>
            <Button
              type="button"
              className="bg-primary"
              onClick={approveAndGenerate}
              disabled={loadingOutline || !outline || generating}
            >
              Approve & generate
            </Button>
          </div>
        </div>
      )}

      <GenerationProgress
        isOpen={generating || step === "generate"}
        currentStage={generationStage}
        onCancel={() => {
          abortController?.abort();
          setGenerating(false);
          setStep("outline");
        }}
      />
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MemoryService } from "@/lib/api/services/memory.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";

export function BusinessContextPanel() {
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();
  const [tone, setTone] = useState("");
  const [brandVoice, setBrandVoice] = useState("");
  const [audience, setAudience] = useState("");
  const [goals, setGoals] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.WORKSPACE_MEMORY(currentSiteId) : [],
    queryFn: () => MemoryService.getMemory(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const saveMutation = useMutation({
    mutationFn: () =>
      MemoryService.updateMemory(currentSiteId as string, {
        preferences: { tone: tone || data?.preferences.tone },
        strategic: {
          website_url: data?.strategic.website_url,
          brand_voice: brandVoice || data?.strategic.brand_voice,
          target_audience: audience
            ? audience
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : (data?.strategic.target_audience ?? []),
          business_goals: goals
            ? goals
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : (data?.strategic.business_goals ?? []),
          seo_priorities: data?.strategic.seo_priorities ?? [],
          publishing_channels: data?.strategic.publishing_channels ?? [],
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.WORKSPACE_MEMORY(currentSiteId as string) });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  if (!currentSiteId) {
    return (
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center">
        <p className="mb-4 text-gray-400">Choose a workspace in the workspace switcher to view business context.</p>
        <Link href="/dashboard/sites" className="text-primary hover:underline">
          View workspaces
        </Link>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
          <p className="text-gray-400">Loading business context…</p>
        </div>
      </div>
    );
  }

  const displayTone = tone || data.preferences.tone || "";
  const displayVoice = brandVoice || data.strategic.brand_voice || "";
  const displayAudience = audience || data.strategic.target_audience?.join(", ") || "";
  const displayGoals = goals || data.strategic.business_goals?.join(", ") || "";

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-white">Business context</h2>
        <p className="mt-1 text-sm text-gray-400">
          Facts and preferences the AI uses in conversations and blog drafts for this workspace.
        </p>
      </div>

      {saveSuccess && (
        <div className="mb-6 rounded-md border border-green-800 bg-green-900/20 p-3 text-sm text-green-400">
          Business context saved.
        </div>
      )}

      <div className="space-y-6">
        {data.strategic.website_url && (
          <div>
            <Label className="text-gray-300">Website</Label>
            <p className="mt-1 break-all text-sm text-gray-400">
              <a
                href={data.strategic.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {data.strategic.website_url}
              </a>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Used for website-first setup. Ask the AI in chat to refresh business context from a URL.
            </p>
          </div>
        )}
        <div>
          <Label className="text-gray-300">Tone</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={displayTone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="e.g. conversational, expert"
          />
        </div>
        <div>
          <Label className="text-gray-300">Brand voice</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={displayVoice}
            onChange={(e) => setBrandVoice(e.target.value)}
            placeholder="How your brand sounds"
          />
        </div>
        <div>
          <Label className="text-gray-300">Target audience (comma-separated)</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={displayAudience}
            onChange={(e) => setAudience(e.target.value)}
            placeholder="e.g. startup founders, marketing managers"
          />
        </div>
        <div>
          <Label className="text-gray-300">Business goals (comma-separated)</Label>
          <Input
            className="mt-1 border-gray-700 bg-gray-800"
            value={displayGoals}
            onChange={(e) => setGoals(e.target.value)}
            placeholder="e.g. drive signups, build thought leadership"
          />
        </div>

        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
          className="bg-primary text-white hover:bg-primary/90"
        >
          {saveMutation.isPending ? "Saving…" : "Save changes"}
        </Button>
      </div>

      {data.behavioral_rules?.length > 0 && (
        <div className="mt-8 border-t border-gray-800 pt-8">
          <h3 className="mb-3 text-lg font-semibold text-white">Writing rules</h3>
          <ul className="space-y-2">
            {data.behavioral_rules.map((rule) => (
              <li key={rule.rule_id} className="rounded-md border border-gray-800 px-3 py-2 text-sm">
                <span className="capitalize text-primary">{rule.polarity}</span>: {rule.rule_text}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.memory_summary && (
        <div className="mt-8 border-t border-gray-800 pt-8">
          <h3 className="mb-3 text-lg font-semibold text-white">Rolling summary</h3>
          <p className="whitespace-pre-wrap text-sm text-gray-400">{data.memory_summary}</p>
        </div>
      )}
    </div>
  );
}

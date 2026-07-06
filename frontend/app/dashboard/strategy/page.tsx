"use client";

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { MemoryService, type StrategyGenerateResult } from "@/lib/api/services/memory.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";
import { format } from "date-fns";

export default function StrategyBoardPage() {
  const { currentSiteId } = useAuthStore();
  const [result, setResult] = useState<StrategyGenerateResult | null>(null);

  const { data: strategy, isLoading } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.WORKSPACE_STRATEGY(currentSiteId) : [],
    queryFn: () => MemoryService.getStrategy(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const generateMutation = useMutation({
    mutationFn: () => MemoryService.generateStrategy(currentSiteId as string),
    onSuccess: (data) => setResult(data),
  });

  if (!currentSiteId) {
    return <div className="p-8 text-gray-400">Select a workspace to view strategy.</div>;
  }

  const display = result ?? null;
  const themes = display?.themes ?? strategy?.strategy_state?.active_themes ?? [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Breadcrumb items={[{ label: "Dashboard" }, { label: "Strategy" }]} />
        <div className="flex items-center justify-between mt-4 mb-8">
          <div>
            <h1 className="text-3xl font-display">Strategy board</h1>
            <p className="text-gray-400 text-sm mt-1">Content themes, ideas, and proposed calendar</p>
          </div>
          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending}
            className="bg-primary text-white"
          >
            {generateMutation.isPending ? "Generating…" : "Generate strategy"}
          </Button>
        </div>

        {isLoading && <p className="text-gray-500">Loading strategy…</p>}

        {themes.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Active themes</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {themes.map((t: { name: string; pillar: string; priority: number }) => (
                <div key={t.name} className="rounded-lg border border-gray-800 bg-gray-900/50 p-4">
                  <p className="font-medium">{t.name}</p>
                  <p className="text-xs text-gray-500">{t.pillar}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {display?.ideas && display.ideas.length > 0 && (
          <section className="mb-8">
            <h2 className="text-lg font-semibold mb-3">Content ideas</h2>
            <ul className="space-y-3">
              {display.ideas.map((idea) => (
                <li key={idea.title} className="rounded-lg border border-gray-800 p-4">
                  <p className="font-medium">{idea.title}</p>
                  <p className="text-sm text-gray-400 mt-1">{idea.angle}</p>
                  <p className="text-xs text-gray-500 mt-2 capitalize">
                    {idea.funnel_stage} · {idea.effort} effort
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {display?.calendar && display.calendar.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-3">Proposed calendar</h2>
            <ul className="space-y-2">
              {display.calendar.map((slot) => (
                <li
                  key={`${slot.scheduled_at}-${slot.idea_title}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 rounded-md border border-gray-800 px-4 py-3 text-sm"
                >
                  <span className="text-primary shrink-0 w-28">
                    {format(new Date(slot.scheduled_at), "MMM d, yyyy")}
                  </span>
                  <span className="font-medium flex-1">{slot.idea_title}</span>
                  <span className="text-gray-500 capitalize">{slot.narrative_phase}</span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {!display && !isLoading && (
          <p className="text-gray-500 text-sm">
            No strategy generated yet. Click &quot;Generate strategy&quot; to create themes and a posting calendar.
          </p>
        )}
      </div>
    </div>
  );
}

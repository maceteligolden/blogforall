"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { MemoryService } from "@/lib/api/services/memory.service";
import {
  StrategicService,
  type KnowledgeGap,
  type StrategicDecision,
  type WorkspaceStrategy,
} from "@/lib/api/services/strategic.service";
import { useAuthStore } from "@/lib/store/auth.store";
import { QUERY_KEYS } from "@/lib/api/config";

function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return "—";
  return `${Math.round(n * 100)}%`;
}

function StrategyEditor({
  strategy,
  onSave,
  saving,
}: {
  strategy: WorkspaceStrategy;
  onSave: (patch: Partial<WorkspaceStrategy>) => void;
  saving: boolean;
}) {
  const [purpose, setPurpose] = useState(strategy.purpose ?? "");
  const [audience, setAudience] = useState(strategy.audience_summary ?? "");
  const [outcomes, setOutcomes] = useState((strategy.long_term_outcomes ?? []).join("\n"));
  const [principles, setPrinciples] = useState((strategy.principles ?? []).join("\n"));
  const [perception, setPerception] = useState((strategy.perception_goals ?? []).join("\n"));
  const [constraints, setConstraints] = useState((strategy.constraints ?? []).join("\n"));

  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-6 space-y-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Workspace strategy</h2>
          <p className="text-sm text-gray-400 mt-1">
            Long-term direction · v{strategy.version} · confidence {pct(strategy.confidence_summary)}
          </p>
        </div>
        <Button
          className="bg-primary text-white"
          disabled={saving}
          onClick={() =>
            onSave({
              purpose,
              audience_summary: audience,
              long_term_outcomes: outcomes
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              principles: principles
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              perception_goals: perception
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
              constraints: constraints
                .split("\n")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        >
          {saving ? "Saving…" : "Save strategy"}
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Purpose</span>
        <textarea
          className="w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm min-h-[72px]"
          value={purpose}
          onChange={(e) => setPurpose(e.target.value)}
        />
      </label>
      <label className="block space-y-1">
        <span className="text-xs text-gray-500 uppercase tracking-wide">Audience summary</span>
        <textarea
          className="w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm min-h-[56px]"
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        {(
          [
            ["Long-term outcomes", outcomes, setOutcomes],
            ["Principles", principles, setPrinciples],
            ["Perception goals", perception, setPerception],
            ["Constraints", constraints, setConstraints],
          ] as const
        ).map(([label, value, set]) => (
          <label key={label} className="block space-y-1">
            <span className="text-xs text-gray-500 uppercase tracking-wide">{label} (one per line)</span>
            <textarea
              className="w-full rounded-md border border-gray-700 bg-black/40 px-3 py-2 text-sm min-h-[96px]"
              value={value}
              onChange={(e) => set(e.target.value)}
            />
          </label>
        ))}
      </div>
    </section>
  );
}

function GapsPanel({ gaps }: { gaps: KnowledgeGap[] }) {
  const top = gaps.slice(0, 8);
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
      <h2 className="text-lg font-semibold mb-1">Knowledge gaps</h2>
      <p className="text-sm text-gray-400 mb-4">Highest strategic value questions to improve confidence</p>
      {top.length === 0 ? (
        <p className="text-sm text-gray-500">No major gaps — business knowledge looks solid.</p>
      ) : (
        <ul className="space-y-3">
          {top.map((g) => (
            <li key={g.key} className="rounded-lg border border-gray-800 p-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-sm font-medium">{g.key.replace(/^business\./, "")}</span>
                <span className="text-xs text-gray-500">
                  {g.status === "missing" ? "missing" : `confidence ${pct(g.confidence)}`} · value{" "}
                  {g.strategic_value.toFixed(2)}
                </span>
              </div>
              <p className="text-sm text-gray-300">{g.question}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function DecisionsPanel({
  decisions,
  onPropose,
  proposing,
}: {
  decisions: StrategicDecision[];
  onPropose: (d: StrategicDecision) => void;
  proposing: boolean;
}) {
  return (
    <section className="rounded-lg border border-gray-800 bg-gray-900/50 p-6">
      <h2 className="text-lg font-semibold mb-1">Next best actions</h2>
      <p className="text-sm text-gray-400 mb-4">Ranked by the Strategic Decision Engine</p>
      {decisions.length === 0 ? (
        <p className="text-sm text-gray-500">No recommended actions right now.</p>
      ) : (
        <ul className="space-y-3">
          {decisions.map((d, i) => (
            <li
              key={`${d.kind}-${i}`}
              className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div>
                <p className="font-medium">{d.title}</p>
                <p className="text-sm text-gray-400 mt-1">{d.rationale}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {d.kind} · score {d.score.toFixed(2)}
                  {d.question ? ` · “${d.question}”` : ""}
                </p>
              </div>
              {(d.kind === "plan_content" || d.kind === "publish_awareness") && (
                <Button
                  variant="outline"
                  className="border-gray-700 text-gray-300 shrink-0"
                  disabled={proposing}
                  onClick={() => onPropose(d)}
                >
                  Propose plan
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function StrategyBoardPage() {
  const { currentSiteId } = useAuthStore();
  const queryClient = useQueryClient();
  const [themesOpen, setThemesOpen] = useState(false);
  const [proposalMsg, setProposalMsg] = useState<string | null>(null);

  const { data: strategy, isLoading } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId) : [],
    queryFn: () => StrategicService.getStrategy(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const { data: gaps = [] } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.STRATEGIC_GAPS(currentSiteId) : [],
    queryFn: () => StrategicService.listGaps(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const { data: decisionsResult } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.STRATEGIC_DECISIONS(currentSiteId) : [],
    queryFn: () => StrategicService.getNextDecisions(currentSiteId as string),
    enabled: !!currentSiteId,
  });

  const { data: contentThemes } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.CONTENT_THEMES(currentSiteId) : [],
    queryFn: () => MemoryService.getStrategy(currentSiteId as string),
    enabled: !!currentSiteId && themesOpen,
  });

  const saveMutation = useMutation({
    mutationFn: (patch: Partial<WorkspaceStrategy>) => StrategicService.updateStrategy(currentSiteId as string, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId as string) });
    },
  });

  const regenerateMutation = useMutation({
    mutationFn: () => StrategicService.regenerateStrategy(currentSiteId as string),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId as string) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_DECISIONS(currentSiteId as string) });
    },
  });

  const proposeMutation = useMutation({
    mutationFn: (d: StrategicDecision) =>
      StrategicService.proposeDecisionAction(currentSiteId as string, {
        kind: d.kind,
        campaign_id: d.campaign_id,
        accept: false,
      }),
    onSuccess: (data) => {
      setProposalMsg(data.message);
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.STRATEGIC_DECISIONS(currentSiteId as string) });
    },
  });

  if (!currentSiteId) {
    return <div className="p-8 text-gray-400">Select a workspace to view strategy.</div>;
  }

  const themes = contentThemes?.strategy_state?.active_themes ?? [];

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Breadcrumb items={[{ label: "Dashboard" }, { label: "Strategy" }]} />
        <div className="flex items-center justify-between mt-4 mb-8 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-display">Strategy</h1>
            <p className="text-gray-400 text-sm mt-1">
              Business direction, knowledge confidence, and highest-value next actions
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300"
              onClick={() => setThemesOpen((v) => !v)}
            >
              {themesOpen ? "Hide content themes" : "Content themes"}
            </Button>
            <Button
              onClick={() => regenerateMutation.mutate()}
              disabled={regenerateMutation.isPending}
              className="bg-primary text-white"
            >
              {regenerateMutation.isPending ? "Regenerating…" : "Regenerate strategy"}
            </Button>
          </div>
        </div>

        {proposalMsg && (
          <div className="mb-6 rounded-lg border border-primary/40 bg-primary/10 px-4 py-3 text-sm">{proposalMsg}</div>
        )}

        {isLoading && <p className="text-gray-500">Loading strategy…</p>}

        {strategy && (
          <div className="space-y-6">
            <StrategyEditor
              key={strategy._id ?? strategy.version}
              strategy={strategy}
              saving={saveMutation.isPending}
              onSave={(patch) => saveMutation.mutate(patch)}
            />
            <GapsPanel gaps={gaps} />
            <DecisionsPanel
              decisions={decisionsResult?.decisions ?? []}
              proposing={proposeMutation.isPending}
              onPropose={(d) => proposeMutation.mutate(d)}
            />
          </div>
        )}

        {themesOpen && (
          <section className="mt-8 rounded-lg border border-gray-800 bg-gray-900/50 p-6">
            <h2 className="text-lg font-semibold mb-1">Content themes</h2>
            <p className="text-sm text-gray-400 mb-4">
              Program-level themes and calendar (separate from WorkspaceStrategy)
            </p>
            {themes.length === 0 ? (
              <p className="text-sm text-gray-500">No active themes yet. Generate from Campaigns or Memory.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {themes.map((t: { name: string; pillar: string; priority: number }) => (
                  <div key={t.name} className="rounded-lg border border-gray-800 bg-black/30 p-4">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t.pillar} · priority {t.priority}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}

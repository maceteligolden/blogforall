"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  ContentStrategyDocument,
  ContentStrategyGenerationStatus,
  WorkspaceStrategy,
} from "@/lib/api/services/strategic.service";

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function Field({
  label,
  hint,
  value,
  onChange,
  rows = 2,
  className = "",
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  const short = rows <= 1;
  return (
    <label className={`block min-w-0 space-y-1 ${className}`}>
      <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
      {hint ? <p className="text-xs text-gray-500">{hint}</p> : null}
      {short ? (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 bg-black/50 border-gray-700 text-white"
        />
      ) : (
        <textarea
          className="w-full rounded-md border border-gray-700 bg-black/50 px-3 py-2 text-sm text-white placeholder:text-gray-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function Section({ title, confidence, children }: { title: string; confidence?: number; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-gray-800 bg-gray-900/40 p-4 sm:p-5 space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {confidence != null && Number.isFinite(confidence) ? (
          <span className="text-[11px] text-gray-500 shrink-0">{Math.round(confidence * 100)}%</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const JOB_LABELS: Array<{ key: "awareness" | "authority" | "demand" | "conversion" | "retention"; label: string }> = [
  { key: "awareness", label: "Awareness" },
  { key: "authority", label: "Authority" },
  { key: "demand", label: "Demand" },
  { key: "conversion", label: "Conversion" },
  { key: "retention", label: "Retention" },
];

const TABS = [
  { id: "north_star", label: "North star" },
  { id: "audience", label: "Audience" },
  { id: "positioning", label: "Positioning" },
  { id: "narrative", label: "Narrative" },
  { id: "franchise", label: "Franchise" },
  { id: "voice", label: "Voice" },
  { id: "conversion", label: "Conversion" },
  { id: "guardrails", label: "Guardrails" },
  { id: "measurement", label: "Measurement" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function ContentStrategyEditor({
  strategy,
  fallbackWebsiteUrl,
  onSave,
  onGenerate,
  saving,
  generating,
}: {
  strategy: WorkspaceStrategy;
  fallbackWebsiteUrl?: string;
  onSave: (patch: { document: ContentStrategyDocument; website_url?: string }) => void;
  onGenerate: (websiteUrl: string) => void;
  saving: boolean;
  generating: boolean;
}) {
  const d = strategy.document;
  const [tab, setTab] = useState<TabId>("north_star");
  const [websiteUrl, setWebsiteUrl] = useState(strategy.website_url || fallbackWebsiteUrl || "");
  const [whatWeAre, setWhatWeAre] = useState(d.north_star.what_we_are);
  const [whatWeSell, setWhatWeSell] = useState(d.north_star.what_we_sell);
  const [commercialGoal, setCommercialGoal] = useState(d.north_star.commercial_goal);
  const [growthPriority, setGrowthPriority] = useState(d.north_star.growth_priority);
  const [who, setWho] = useState(d.audience.primary.who);
  const [situation, setSituation] = useState(d.audience.primary.situation);
  const [jtbd, setJtbd] = useState(d.audience.primary.jtbd);
  const [beliefs, setBeliefs] = useState(d.audience.primary.beliefs_to_change.join("\n"));
  const [awareness, setAwareness] = useState(d.audience.awareness_stage);
  const [category, setCategory] = useState(d.positioning.category);
  const [differentiation, setDifferentiation] = useState(d.positioning.differentiation);
  const [valueProp, setValueProp] = useState(d.positioning.value_proposition);
  const [competitors, setCompetitors] = useState(
    d.positioning.competitors.map((c) => (c.notes ? `${c.name} — ${c.notes}` : c.name)).join("\n")
  );
  const [statement, setStatement] = useState(d.positioning.statement);
  const [coreMessage, setCoreMessage] = useState(d.narrative.core_message);
  const [supporting, setSupporting] = useState(d.narrative.supporting_messages.join("\n"));
  const [proof, setProof] = useState(d.narrative.proof_points.join("\n"));
  const [canClaim, setCanClaim] = useState(d.narrative.claims_we_can_make.join("\n"));
  const [mustNot, setMustNot] = useState(d.narrative.claims_we_must_not_make.join("\n"));
  const [pov, setPov] = useState(d.narrative.editorial_pov);
  const [pillars, setPillars] = useState(
    d.content_franchise.pillars
      .map((p) => [p.name, p.authority_thesis, p.in_scope.join(", "), p.out_of_scope.join(", ")].join(" | "))
      .join("\n")
  );
  const [personality, setPersonality] = useState(d.voice.personality);
  const [voice, setVoice] = useState(d.voice.voice);
  const [tone, setTone] = useState(d.voice.tone_range);
  const [principles, setPrinciples] = useState(d.voice.writing_principles.join("\n"));
  const [wordsUse, setWordsUse] = useState(d.voice.words_to_use.join("\n"));
  const [wordsAvoid, setWordsAvoid] = useState(d.voice.words_to_avoid.join("\n"));
  const [jobs, setJobs] = useState(
    d.jobs_of_content ?? {
      awareness: 0.2,
      authority: 0.2,
      demand: 0.2,
      conversion: 0.2,
      retention: 0.2,
    }
  );
  const [desiredAction, setDesiredAction] = useState(d.conversion.desired_action);
  const [primaryCta, setPrimaryCta] = useState(d.conversion.primary_cta);
  const [secondaryCta, setSecondaryCta] = useState(d.conversion.secondary_cta);
  const [offerSupport, setOfferSupport] = useState(d.conversion.how_content_supports_offer);
  const [always, setAlways] = useState(d.guardrails.always.join("\n"));
  const [never, setNever] = useState(d.guardrails.never.join("\n"));
  const [accuracy, setAccuracy] = useState(d.guardrails.accuracy_bar);
  const [restrictions, setRestrictions] = useState(d.guardrails.audience_restrictions.join("\n"));
  const [kpis, setKpis] = useState(d.measurement.content_kpis.join("\n"));
  const [outcomes, setOutcomes] = useState(d.measurement.business_outcomes.join("\n"));

  useEffect(() => {
    setWebsiteUrl(strategy.website_url || fallbackWebsiteUrl || "");
  }, [strategy.website_url, strategy.version, fallbackWebsiteUrl]);

  const conf = strategy.section_confidence ?? {};
  const urlReady = Boolean(websiteUrl.trim());
  const busy = saving || generating;

  const handleSave = () => {
    const document: ContentStrategyDocument = {
      ...d,
      north_star: {
        what_we_are: whatWeAre,
        what_we_sell: whatWeSell,
        commercial_goal: commercialGoal,
        growth_priority: growthPriority,
      },
      audience: {
        ...d.audience,
        primary: {
          who,
          situation,
          jtbd,
          beliefs_to_change: lines(beliefs),
        },
        awareness_stage: awareness,
      },
      positioning: {
        category,
        differentiation,
        value_proposition: valueProp,
        statement,
        competitors: lines(competitors).map((row) => {
          const [name, notes] = row.split("—").map((s) => s.trim());
          return { name: name || row, notes: notes || undefined };
        }),
      },
      narrative: {
        core_message: coreMessage,
        supporting_messages: lines(supporting),
        proof_points: lines(proof),
        claims_we_can_make: lines(canClaim),
        claims_we_must_not_make: lines(mustNot),
        editorial_pov: pov,
      },
      content_franchise: {
        ...d.content_franchise,
        pillars: lines(pillars).map((row) => {
          const [name, thesis, inScope, outScope] = row.split("|").map((s) => s.trim());
          return {
            name: name || row,
            authority_thesis: thesis || "",
            in_scope: inScope
              ? inScope
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
            out_of_scope: outScope
              ? outScope
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean)
              : [],
          };
        }),
      },
      voice: {
        personality,
        voice,
        tone_range: tone,
        writing_principles: lines(principles),
        words_to_use: lines(wordsUse),
        words_to_avoid: lines(wordsAvoid),
      },
      jobs_of_content: jobs,
      conversion: {
        desired_action: desiredAction,
        primary_cta: primaryCta,
        secondary_cta: secondaryCta,
        how_content_supports_offer: offerSupport,
      },
      guardrails: {
        always: lines(always),
        never: lines(never),
        accuracy_bar: accuracy,
        audience_restrictions: lines(restrictions),
      },
      measurement: {
        content_kpis: lines(kpis),
        business_outcomes: lines(outcomes),
      },
    };
    onSave({ document, website_url: websiteUrl.trim() || undefined });
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-4 sm:p-5 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="block min-w-0 flex-1 space-y-1">
            <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">Website URL</span>
            <Input
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              placeholder="https://example.com"
              className="h-10 bg-black/50 border-gray-700 text-white"
            />
          </label>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 text-gray-200 w-full sm:w-auto"
              disabled={busy || !urlReady}
              onClick={() => onGenerate(websiteUrl.trim())}
            >
              {generating ? "Generating…" : "Generate from website"}
            </Button>
            <Button
              type="button"
              className="bg-primary text-white w-full sm:w-auto"
              disabled={busy}
              onClick={handleSave}
            >
              {saving ? "Saving…" : "Save strategy"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Editorial constitution · v{strategy.version}
          {strategy.generation_status ? ` · ${strategy.generation_status}` : ""}
        </p>
      </div>

      <nav className="flex gap-1 border-b border-gray-800 overflow-x-auto" aria-label="Content strategy sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-primary text-white" : "border-transparent text-gray-500 hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "north_star" && (
        <Section title="North star" confidence={conf.north_star?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="What the business is" value={whatWeAre} onChange={setWhatWeAre} />
            <Field label="What it sells" value={whatWeSell} onChange={setWhatWeSell} />
            <Field label="Commercial goal" value={commercialGoal} onChange={setCommercialGoal} />
            <Field label="Growth priority" value={growthPriority} onChange={setGrowthPriority} />
          </div>
        </Section>
      )}

      {tab === "audience" && (
        <Section title="Audience" confidence={conf.audience?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Primary who" value={who} onChange={setWho} />
            <Field label="Awareness stage" value={awareness} onChange={setAwareness} rows={1} />
            <Field label="Situation" value={situation} onChange={setSituation} className="sm:col-span-2" />
            <Field label="Job to be done" value={jtbd} onChange={setJtbd} />
            <Field label="Beliefs to change" hint="One per line" value={beliefs} onChange={setBeliefs} rows={3} />
          </div>
        </Section>
      )}

      {tab === "positioning" && (
        <Section title="Positioning" confidence={conf.positioning?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Category" value={category} onChange={setCategory} rows={1} />
            <Field label="Differentiation" value={differentiation} onChange={setDifferentiation} />
            <Field label="Value proposition" value={valueProp} onChange={setValueProp} className="sm:col-span-2" />
            <Field label="Positioning statement" value={statement} onChange={setStatement} className="sm:col-span-2" />
            <Field
              label="Competitors"
              hint="name — notes, one per line"
              value={competitors}
              onChange={setCompetitors}
              rows={3}
              className="sm:col-span-2"
            />
          </div>
        </Section>
      )}

      {tab === "narrative" && (
        <Section title="Narrative" confidence={conf.narrative?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Core message" value={coreMessage} onChange={setCoreMessage} className="sm:col-span-2" />
            <Field label="Editorial point of view" value={pov} onChange={setPov} className="sm:col-span-2" />
            <Field
              label="Supporting messages"
              hint="One per line"
              value={supporting}
              onChange={setSupporting}
              rows={3}
            />
            <Field label="Proof points" hint="One per line" value={proof} onChange={setProof} rows={3} />
            <Field label="Claims we can make" value={canClaim} onChange={setCanClaim} rows={3} />
            <Field label="Claims we must not make" value={mustNot} onChange={setMustNot} rows={3} />
          </div>
        </Section>
      )}

      {tab === "franchise" && (
        <Section title="Content franchise" confidence={conf.content_franchise?.confidence}>
          <Field
            label="Pillars"
            hint="One per line: name | thesis | in-scope topics | out-of-scope"
            value={pillars}
            onChange={setPillars}
            rows={8}
          />
        </Section>
      )}

      {tab === "voice" && (
        <Section title="Voice" confidence={conf.voice?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Personality" value={personality} onChange={setPersonality} rows={1} />
            <Field label="Voice" value={voice} onChange={setVoice} rows={1} />
            <Field label="Tone range" value={tone} onChange={setTone} className="sm:col-span-2" />
            <Field
              label="Writing principles"
              hint="One per line"
              value={principles}
              onChange={setPrinciples}
              rows={3}
              className="sm:col-span-2"
            />
            <Field label="Words to use" value={wordsUse} onChange={setWordsUse} rows={3} />
            <Field label="Words to avoid" value={wordsAvoid} onChange={setWordsAvoid} rows={3} />
          </div>
        </Section>
      )}

      {tab === "conversion" && (
        <div className="space-y-4">
          <Section title="Jobs of content" confidence={conf.jobs_of_content?.confidence}>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              {JOB_LABELS.map(({ key, label }) => (
                <label key={key} className="block min-w-0 space-y-1">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-gray-500">{label}</span>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={5}
                    value={Math.round((jobs[key] ?? 0) * 100)}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      setJobs((prev) => ({
                        ...prev,
                        [key]: Number.isFinite(n) ? Math.min(1, Math.max(0, n / 100)) : 0,
                      }));
                    }}
                    className="h-9 bg-black/50 border-gray-700 text-white"
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-500">Share of effort as a percent. Aim for about 100% total.</p>
          </Section>
          <Section title="Conversion" confidence={conf.conversion?.confidence}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Desired action" value={desiredAction} onChange={setDesiredAction} />
              <Field label="How content supports the offer" value={offerSupport} onChange={setOfferSupport} />
              <Field label="Primary CTA" value={primaryCta} onChange={setPrimaryCta} rows={1} />
              <Field label="Secondary CTA" value={secondaryCta} onChange={setSecondaryCta} rows={1} />
            </div>
          </Section>
        </div>
      )}

      {tab === "guardrails" && (
        <Section title="Guardrails" confidence={conf.guardrails?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Always" hint="One per line" value={always} onChange={setAlways} rows={3} />
            <Field label="Never" hint="One per line" value={never} onChange={setNever} rows={3} />
            <Field label="Accuracy bar" value={accuracy} onChange={setAccuracy} rows={1} className="sm:col-span-2" />
            <Field
              label="Audience restrictions"
              value={restrictions}
              onChange={setRestrictions}
              rows={2}
              className="sm:col-span-2"
            />
          </div>
        </Section>
      )}

      {tab === "measurement" && (
        <Section title="Measurement" confidence={conf.measurement?.confidence}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Content KPIs" hint="One per line" value={kpis} onChange={setKpis} rows={3} />
            <Field label="Business outcomes" hint="One per line" value={outcomes} onChange={setOutcomes} rows={3} />
          </div>
        </Section>
      )}
    </div>
  );
}

export function generationBanner(status?: ContentStrategyGenerationStatus, error?: string) {
  if (status === "generating") {
    return "Generating Content Strategy from your website. You can keep exploring the dashboard — campaigns unlock when this is ready.";
  }
  if (status === "failed") {
    return error || "Content Strategy generation failed. Add a website URL and retry, or fill the editor manually.";
  }
  return null;
}

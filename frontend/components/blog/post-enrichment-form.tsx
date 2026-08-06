"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PostEnrichment } from "@/lib/types/interactive-post";

type Props = {
  value: PostEnrichment;
  onChange: (next: PostEnrichment) => void;
};

function linesToList(text: string): string[] {
  return text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function PostEnrichmentForm({ value, onChange }: Props) {
  const set = <K extends keyof PostEnrichment>(key: K, v: PostEnrichment[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-400">
        Help the AI write a stronger post. Everything here is optional but improves quality.
      </p>

      <div>
        <Label className="text-gray-300">Links to include (one per line)</Label>
        <textarea
          className="mt-1 w-full min-h-[80px] rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
          placeholder="https://example.com/report"
          value={(value.links || []).join("\n")}
          onChange={(e) => set("links", linesToList(e.target.value))}
        />
      </div>

      <div>
        <Label className="text-gray-300">Example / competitor URLs</Label>
        <textarea
          className="mt-1 w-full min-h-[60px] rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
          placeholder="Optional style references"
          value={(value.example_urls || []).join("\n")}
          onChange={(e) => set("example_urls", linesToList(e.target.value))}
        />
      </div>

      <div>
        <Label className="text-gray-300">Personal notes</Label>
        <textarea
          className="mt-1 w-full min-h-[80px] rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
          placeholder="Anecdotes, stats, points of view…"
          value={value.personal_notes || ""}
          onChange={(e) => set("personal_notes", e.target.value)}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-gray-300">Must include</Label>
          <Input
            className="mt-1 bg-black border-gray-700 text-white"
            value={value.must_include || ""}
            onChange={(e) => set("must_include", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-gray-300">Must avoid</Label>
          <Input
            className="mt-1 bg-black border-gray-700 text-white"
            value={value.must_avoid || ""}
            onChange={(e) => set("must_avoid", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-gray-300">Audience override</Label>
          <Input
            className="mt-1 bg-black border-gray-700 text-white"
            value={value.target_audience || ""}
            onChange={(e) => set("target_audience", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-gray-300">CTA</Label>
          <Input
            className="mt-1 bg-black border-gray-700 text-white"
            value={value.cta || ""}
            onChange={(e) => set("cta", e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label className="text-gray-300">Tone</Label>
          <Input
            className="mt-1 bg-black border-gray-700 text-white"
            placeholder="e.g. practical, confident"
            value={value.tone || ""}
            onChange={(e) => set("tone", e.target.value)}
          />
        </div>
        <div>
          <Label className="text-gray-300">Length</Label>
          <select
            className="mt-1 w-full rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
            value={value.length_preset || "medium"}
            onChange={(e) => set("length_preset", e.target.value as PostEnrichment["length_preset"])}
          >
            <option value="short">Short (~800)</option>
            <option value="medium">Medium (~1500)</option>
            <option value="long">Long (~2500)</option>
            <option value="pillar">Pillar (~3500)</option>
          </select>
        </div>
      </div>

      <div>
        <Label className="text-gray-300">Writing style variant</Label>
        <select
          className="mt-1 w-full rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
          value={value.style_variant || ""}
          onChange={(e) => set("style_variant", e.target.value)}
        >
          <option value="">Auto (recommended)</option>
          <option value="operator_checklist">How-to: checklist</option>
          <option value="coach_walkthrough">How-to: coach walkthrough</option>
          <option value="war_story_howto">How-to: war story</option>
          <option value="curated_survey">Listicle: survey</option>
          <option value="ranked_picks">Listicle: ranked</option>
          <option value="criteria_debate">Comparison: criteria</option>
          <option value="buyer_brief">Roundup: buyer brief</option>
          <option value="customer_hero">Case study: customer hero</option>
          <option value="polemic">Thought leadership: polemic</option>
          <option value="framework_essay">Framework essay</option>
          <option value="field_manual">Definitive: field manual</option>
        </select>
      </div>

      <div className="rounded-md border border-dashed border-gray-700 p-4 opacity-60">
        <p className="text-sm text-gray-400">Knowledge base attach — coming soon</p>
        <button
          type="button"
          disabled
          className="mt-2 text-xs px-3 py-1.5 rounded bg-gray-800 text-gray-500 cursor-not-allowed"
        >
          Attach knowledge base
        </button>
      </div>
    </div>
  );
}

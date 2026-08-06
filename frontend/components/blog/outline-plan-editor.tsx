"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { OutlineSection, PostOutline } from "@/lib/types/interactive-post";
import { Plus, Trash2 } from "lucide-react";

type Props = {
  outline: PostOutline;
  onChange: (next: PostOutline) => void;
};

export function OutlinePlanEditor({ outline, onChange }: Props) {
  const updateSection = (idx: number, patch: Partial<OutlineSection>) => {
    const sections = outline.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s));
    onChange({ ...outline, sections });
  };

  const removeSection = (idx: number) => {
    if (outline.sections.length <= 2) return;
    onChange({ ...outline, sections: outline.sections.filter((_, i) => i !== idx) });
  };

  const addSection = () => {
    if (outline.sections.length >= 12) return;
    onChange({
      ...outline,
      sections: [
        ...outline.sections,
        { id: `sec_${Date.now()}`, heading: "New section", intent: "Describe what this section will do." },
      ],
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-gray-300">Working title</Label>
        <Input
          className="mt-1 bg-black border-gray-700 text-white"
          value={outline.working_title}
          onChange={(e) => onChange({ ...outline, working_title: e.target.value })}
        />
      </div>
      <div>
        <Label className="text-gray-300">Thesis</Label>
        <textarea
          className="mt-1 w-full min-h-[70px] rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
          value={outline.thesis}
          onChange={(e) => onChange({ ...outline, thesis: e.target.value })}
        />
      </div>
      <div className="text-xs text-gray-500">
        Keywords: {outline.keywords.join(", ")} · {outline.keyword_notes}
      </div>
      <p className="text-sm text-gray-400">{outline.campaign_tie_in}</p>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-gray-300">Sections</Label>
          <Button type="button" variant="outline" size="sm" onClick={addSection}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Add
          </Button>
        </div>
        {outline.sections.map((section, idx) => (
          <div key={section.id || idx} className="rounded-lg border border-gray-800 p-3 space-y-2">
            <div className="flex gap-2">
              <Input
                className="bg-black border-gray-700 text-white"
                value={section.heading}
                onChange={(e) => updateSection(idx, { heading: e.target.value })}
              />
              <button
                type="button"
                className="text-gray-500 hover:text-red-400"
                onClick={() => removeSection(idx)}
                aria-label="Remove section"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <textarea
              className="w-full min-h-[56px] rounded-md bg-black border border-gray-700 text-white px-3 py-2 text-sm"
              placeholder="What this section will accomplish"
              value={section.intent}
              onChange={(e) => updateSection(idx, { intent: e.target.value })}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BlogGenerationFormParams, BlogLengthPreset } from "@/lib/utils/blog-ai-generation-params";

export type { BlogGenerationFormParams, BlogLengthPreset } from "@/lib/utils/blog-ai-generation-params";
export { defaultBlogGenerationFormParams, getWordCountFromFormParams, topicsInputToArray } from "@/lib/utils/blog-ai-generation-params";

interface BlogAiGenerationSettingsProps {
  value: BlogGenerationFormParams;
  onChange: (next: BlogGenerationFormParams) => void;
  disabled?: boolean;
}

export function BlogAiGenerationSettings({ value, onChange, disabled }: BlogAiGenerationSettingsProps) {
  const patch = (partial: Partial<BlogGenerationFormParams>) => onChange({ ...value, ...partial });

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900/80 p-4 space-y-4">
      <h4 className="text-sm font-semibold text-white">Generation settings</h4>
      <p className="text-xs text-gray-500">
        Set these before analyzing your prompt. They are sent to the AI for analysis and generation.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="ai-length-preset" className="text-gray-300">
            Length
          </Label>
          <select
            id="ai-length-preset"
            value={value.lengthPreset}
            onChange={(e) => patch({ lengthPreset: e.target.value as BlogLengthPreset })}
            disabled={disabled}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="">Let AI infer</option>
            <option value="short">Short (~800 words)</option>
            <option value="medium">Medium (~1500 words)</option>
            <option value="long">Long (~2500 words)</option>
            <option value="custom">Custom word count</option>
          </select>
        </div>

        {value.lengthPreset === "custom" && (
          <div>
            <Label htmlFor="ai-custom-words" className="text-gray-300">
              Word count (300–8000)
            </Label>
            <Input
              id="ai-custom-words"
              type="number"
              min={300}
              max={8000}
              value={value.customWordCount}
              onChange={(e) => patch({ customWordCount: parseInt(e.target.value, 10) || 300 })}
              disabled={disabled}
              className="mt-1 bg-black border-gray-700 text-white"
            />
          </div>
        )}

        <div>
          <Label htmlFor="ai-tone" className="text-gray-300">
            Tone
          </Label>
          <select
            id="ai-tone"
            value={value.tone}
            onChange={(e) => patch({ tone: e.target.value })}
            disabled={disabled}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="">Let AI infer</option>
            <option value="professional">Professional</option>
            <option value="conversational">Conversational</option>
            <option value="friendly">Friendly</option>
            <option value="authoritative">Authoritative</option>
            <option value="playful">Playful</option>
            <option value="neutral">Neutral / journalistic</option>
          </select>
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="ai-audience" className="text-gray-300">
            Target audience (optional)
          </Label>
          <Input
            id="ai-audience"
            value={value.target_audience}
            onChange={(e) => patch({ target_audience: e.target.value })}
            disabled={disabled}
            placeholder="e.g., beginner developers, marketing managers"
            className="mt-1 bg-black border-gray-700 text-white"
          />
        </div>

        <div className="sm:col-span-2">
          <Label htmlFor="ai-topics" className="text-gray-300">
            Topics to explore (comma-separated)
          </Label>
          <Input
            id="ai-topics"
            value={value.topicsInput}
            onChange={(e) => patch({ topicsInput: e.target.value })}
            disabled={disabled}
            placeholder="e.g., performance, security, onboarding"
            className="mt-1 bg-black border-gray-700 text-white"
          />
        </div>

        <div>
          <Label htmlFor="ai-purpose" className="text-gray-300">
            Purpose (optional)
          </Label>
          <select
            id="ai-purpose"
            value={value.purpose}
            onChange={(e) => patch({ purpose: e.target.value })}
            disabled={disabled}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="">Let AI infer</option>
            <option value="inform">Inform</option>
            <option value="educate">Educate / teach</option>
            <option value="persuade">Persuade</option>
            <option value="entertain">Entertain</option>
            <option value="tutorial">Tutorial / how-to</option>
            <option value="opinion">Opinion / commentary</option>
            <option value="news">News / update</option>
          </select>
        </div>

        <div>
          <Label htmlFor="ai-structure" className="text-gray-300">
            Structure (optional)
          </Label>
          <select
            id="ai-structure"
            value={value.structure}
            onChange={(e) => patch({ structure: e.target.value })}
            disabled={disabled}
            className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
          >
            <option value="">Let AI infer</option>
            <option value="tutorial">Tutorial</option>
            <option value="listicle">Listicle</option>
            <option value="opinion">Opinion piece</option>
            <option value="guide">Guide / deep dive</option>
            <option value="comparison">Comparison</option>
            <option value="case-study">Case study</option>
            <option value="interview">Interview / Q&A style</option>
          </select>
        </div>
      </div>
    </div>
  );
}

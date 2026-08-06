"use client";

import { AI_WIZARD_STEPS, type AiWizardStep } from "@/lib/types/interactive-post";

export function AiPostWizardProgress({ step }: { step: AiWizardStep }) {
  const activeIdx = Math.max(
    0,
    AI_WIZARD_STEPS.findIndex((s) => s.id === step)
  );

  return (
    <ol className="flex flex-wrap gap-2 mb-6" aria-label="Post creation steps">
      {AI_WIZARD_STEPS.map((s, i) => {
        const done = i < activeIdx;
        const active = i === activeIdx || (step === "done" && i === AI_WIZARD_STEPS.length - 1);
        return (
          <li
            key={s.id}
            className={`px-3 py-1.5 text-xs rounded-md border ${
              active
                ? "border-primary bg-primary/20 text-white"
                : done
                  ? "border-gray-600 text-gray-300"
                  : "border-gray-800 text-gray-500"
            }`}
          >
            {i + 1}. {s.label}
          </li>
        );
      })}
    </ol>
  );
}

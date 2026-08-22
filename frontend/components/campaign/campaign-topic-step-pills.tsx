"use client";

import { cn } from "@/lib/utils/cn";

const STEPS = [
  { id: "campaign", label: "Campaign" },
  { id: "topic", label: "Topic" },
] as const;

export type CampaignTopicStep = (typeof STEPS)[number]["id"];

export function CampaignTopicStepPills({ step, label }: { step: CampaignTopicStep; label: string }) {
  return (
    <ol className="flex flex-wrap gap-2 mb-6" aria-label={label}>
      {STEPS.map((s, i) => {
        const active = s.id === step;
        const done = step === "topic" && s.id === "campaign";
        return (
          <li
            key={s.id}
            className={cn(
              "px-3 py-1.5 text-xs rounded-md border",
              active
                ? "border-primary bg-primary/20 text-white"
                : done
                  ? "border-gray-600 text-gray-300"
                  : "border-gray-800 text-gray-500"
            )}
          >
            {i + 1}. {s.label}
          </li>
        );
      })}
    </ol>
  );
}

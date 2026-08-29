"use client";

import { useEffect, useState } from "react";
import type { PublishDestinationOption } from "@/lib/api/services/integration.service";
import { ConfigureFramerDialog } from "@/components/integrations/configure-framer-dialog";

export function hasExternalCms(destinations: PublishDestinationOption[] | undefined): boolean {
  return (destinations ?? []).some((item) => item.provider !== "bloggr");
}

export function defaultDestinationSelection(
  destinations: PublishDestinationOption[] | undefined,
  preferred?: string[]
): string[] {
  const available = (destinations ?? []).map((item) => item.provider);
  const fromPreferred = (preferred ?? []).filter((item) => available.includes(item));
  if (fromPreferred.length) return fromPreferred;
  if (available.includes("bloggr")) return ["bloggr"];
  return available.length ? available : ["bloggr"];
}

export function isPublishHitlAction(action: string): boolean {
  return action === "blogs_publish" || action === "blogs_schedule";
}

export type PublishDestinationChoice = "bloggr" | "framer" | "both";

export function selectionToChoice(selected: string[]): PublishDestinationChoice {
  const hasBloggr = selected.includes("bloggr");
  const hasFramer = selected.includes("framer");
  if (hasBloggr && hasFramer) return "both";
  if (hasFramer) return "framer";
  return "bloggr";
}

export function choiceToSelection(choice: PublishDestinationChoice): string[] {
  if (choice === "both") return ["bloggr", "framer"];
  if (choice === "framer") return ["framer"];
  return ["bloggr"];
}

export function formatDestinationLabels(selected: string[] | undefined): string {
  if (!selected?.length) return "Bloggr";
  const labels = selected.map((item) => (item === "framer" ? "Framer" : item === "bloggr" ? "Bloggr" : item));
  return labels.join(" + ");
}

export function PublishDestinationPicker({
  destinations,
  selected,
  onChange,
  disabled,
  className,
}: {
  destinations: PublishDestinationOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [configureOpen, setConfigureOpen] = useState(false);
  const [pendingChoice, setPendingChoice] = useState<PublishDestinationChoice | null>(null);
  const connected = hasExternalCms(destinations);
  const choice = selectionToChoice(selected);

  useEffect(() => {
    if (!pendingChoice || !connected) return;
    onChange(choiceToSelection(pendingChoice));
    setPendingChoice(null);
  }, [connected, pendingChoice]); // onChange is applied once when Framer becomes available

  const applyChoice = (next: PublishDestinationChoice) => {
    if ((next === "framer" || next === "both") && !connected) {
      setPendingChoice(next);
      setConfigureOpen(true);
      return;
    }
    onChange(choiceToSelection(next));
  };

  return (
    <fieldset className={className} disabled={disabled}>
      <legend className="text-sm text-gray-300 mb-2">Publish to</legend>
      <select
        className="w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
        value={pendingChoice ?? choice}
        disabled={disabled}
        onChange={(e) => applyChoice(e.target.value as PublishDestinationChoice)}
        aria-label="Publish destination"
      >
        <option value="bloggr">Bloggr</option>
        <option value="framer">{connected ? "Framer" : "Framer (connect)"}</option>
        <option value="both">{connected ? "Bloggr and Framer" : "Bloggr and Framer (connect)"}</option>
      </select>
      <p className="mt-2 text-xs text-gray-400">
        {connected
          ? "Choose Bloggr, your Framer CMS, or both."
          : "Framer is available after you connect it. Selecting it opens setup."}
      </p>
      <ConfigureFramerDialog
        isOpen={configureOpen}
        onClose={() => {
          setConfigureOpen(false);
          if (!connected) setPendingChoice(null);
        }}
        stacked
      />
    </fieldset>
  );
}

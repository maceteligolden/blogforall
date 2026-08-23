"use client";

import { Checkbox } from "@/components/ui/checkbox";
import type { PublishDestinationOption } from "@/lib/api/services/integration.service";

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
  if (!hasExternalCms(destinations)) return null;

  const toggle = (provider: string, checked: boolean) => {
    if (checked) {
      onChange(selected.includes(provider) ? selected : [...selected, provider]);
      return;
    }
    onChange(selected.filter((item) => item !== provider));
  };

  return (
    <fieldset className={className} disabled={disabled}>
      <legend className="text-sm text-gray-300 mb-2">Publish to</legend>
      <div className="space-y-2">
        {destinations.map((dest) => (
          <label key={dest.provider} className="flex items-center gap-2 text-sm text-gray-200 cursor-pointer">
            <Checkbox
              checked={selected.includes(dest.provider)}
              onCheckedChange={(checked) => toggle(dest.provider, Boolean(checked))}
              disabled={disabled}
            />
            {dest.label}
          </label>
        ))}
      </div>
      {selected.length === 0 && <p className="text-xs text-red-400 mt-2">Select at least one destination.</p>}
    </fieldset>
  );
}

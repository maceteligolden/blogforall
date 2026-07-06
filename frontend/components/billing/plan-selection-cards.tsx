"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

export type PlanTier = {
  id: string;
  name: string;
  description: string;
  priceLabel: string;
  features: string[];
  highlighted?: boolean;
  comingSoon?: boolean;
};

export const ONBOARDING_PLAN_TIERS: PlanTier[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for personal blogs",
    priceLabel: "$5",
    features: ["Up to 10 blog posts", "AI content review", "1 site", "Basic campaigns"],
    comingSoon: true,
  },
  {
    id: "professional",
    name: "Professional",
    description: "For growing blogs",
    priceLabel: "$10",
    features: ["Up to 50 blog posts", "3 sites", "Team collaboration", "Priority support"],
    highlighted: true,
    comingSoon: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    description: "For power users & businesses",
    priceLabel: "$20",
    features: ["Unlimited blog posts", "Unlimited sites", "Advanced API", "24/7 priority support"],
    comingSoon: true,
  },
];

type PlanSelectionCardProps = {
  tier: PlanTier;
  selected: boolean;
  onSelect: () => void;
};

export function PlanSelectionCard({ tier, selected, onSelect }: PlanSelectionCardProps) {
  const disabled = tier.comingSoon;

  return (
    <button
      type="button"
      onClick={() => !disabled && onSelect()}
      disabled={disabled}
      className={cn(
        "relative w-full rounded-2xl border p-5 text-left transition-all sm:p-6",
        disabled && "cursor-not-allowed opacity-60",
        selected && !disabled
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
          : "border-gray-800 bg-gradient-to-br from-gray-900 to-black hover:border-gray-700",
        tier.highlighted && !selected && !disabled && "border-primary/40"
      )}
    >
      {tier.comingSoon && (
        <span className="absolute -top-3 right-4 rounded-full bg-gray-800 px-3 py-0.5 text-xs font-medium text-gray-300">
          Coming soon
        </span>
      )}
      {tier.highlighted && !tier.comingSoon && (
        <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
          Recommended
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">{tier.name}</h3>
        <p className="mt-1 text-sm text-gray-400">{tier.description}</p>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">{tier.priceLabel}</span>
          <span className="text-gray-400">/month</span>
        </div>
      </div>

      <ul className="space-y-2">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      {selected && !disabled && (
        <p className="mt-4 text-xs font-medium text-primary">Selected</p>
      )}
    </button>
  );
}

type PlanSelectionGridProps = {
  selectedId?: string;
  onSelect?: (id: string) => void;
};

export function PlanSelectionGrid({ selectedId = "", onSelect }: PlanSelectionGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {ONBOARDING_PLAN_TIERS.map((tier) => (
        <PlanSelectionCard
          key={tier.id}
          tier={tier}
          selected={selectedId === tier.id}
          onSelect={() => onSelect?.(tier.id)}
        />
      ))}
    </div>
  );
}

type PlanContinueButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export function PlanContinueButton({ onClick, disabled, loading }: PlanContinueButtonProps) {
  return (
    <Button
      variant="outline"
      className="w-full border-gray-700 text-gray-300 hover:bg-gray-800 sm:w-auto min-w-[200px]"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? "Continuing..." : "Skip for free"}
    </Button>
  );
}

"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";
import type { Plan } from "@/lib/api/services/subscription.service";

function CheckIcon() {
  return (
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function formatPriceLabel(plan: Plan): string {
  if (plan.price === 0 || plan.interval === "free") return "Free";
  const amount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: (plan.currency || "usd").toUpperCase(),
    minimumFractionDigits: 0,
  }).format(plan.price);
  return amount;
}

function intervalSuffix(plan: Plan): string {
  if (plan.price === 0 || plan.interval === "free") return "";
  if (plan.interval === "year") return "/year";
  return "/month";
}

export function isFreePlan(plan: Plan): boolean {
  return plan.price === 0 || plan.interval === "free";
}

type PlanSelectionCardProps = {
  plan: Plan;
  selected: boolean;
  onSelect: () => void;
  highlighted?: boolean;
};

export function PlanSelectionCard({ plan, selected, onSelect, highlighted }: PlanSelectionCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative w-full rounded-2xl border p-5 text-left transition-all sm:p-6",
        selected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
          : "border-gray-800 bg-gradient-to-br from-gray-900 to-black hover:border-gray-700",
        highlighted && !selected && "border-primary/40"
      )}
    >
      {highlighted && (
        <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
          Recommended
        </span>
      )}

      <div className="mb-4">
        <h3 className="text-xl font-bold text-white">{plan.name}</h3>
        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-4xl font-bold text-white">{formatPriceLabel(plan)}</span>
          {intervalSuffix(plan) && <span className="text-gray-400">{intervalSuffix(plan)}</span>}
        </div>
      </div>

      <ul className="space-y-2">
        {(plan.features?.length ? plan.features : ["Core Bloggr features"]).map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-sm text-gray-300">
            <CheckIcon />
            {feature}
          </li>
        ))}
      </ul>

      {selected && <p className="mt-4 text-xs font-medium text-primary">Selected</p>}
    </button>
  );
}

type PlanSelectionGridProps = {
  plans: Plan[];
  selectedId?: string;
  onSelect?: (id: string) => void;
};

export function PlanSelectionGrid({ plans, selectedId = "", onSelect }: PlanSelectionGridProps) {
  const paidSorted = [...plans].sort((a, b) => a.price - b.price);
  const recommendedId =
    paidSorted.find((p) => !isFreePlan(p))?._id ?? paidSorted[Math.min(1, paidSorted.length - 1)]?._id;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {paidSorted.map((plan) => (
        <PlanSelectionCard
          key={plan._id}
          plan={plan}
          selected={selectedId === plan._id}
          highlighted={plan._id === recommendedId && !isFreePlan(plan)}
          onSelect={() => onSelect?.(plan._id)}
        />
      ))}
    </div>
  );
}

type PlanContinueButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function PlanContinueButton({
  onClick,
  disabled,
  loading,
  label = "Continue",
}: PlanContinueButtonProps) {
  return (
    <Button
      className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto min-w-[200px]"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? "Continuing..." : label}
    </Button>
  );
}

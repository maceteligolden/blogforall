"use client";

import { Button } from "@/components/ui/button";
import { betaTracker } from "@/lib/analytics/flows/beta.tracker";
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
  locked?: boolean;
  lockedLabel?: string;
};

export function PlanSelectionCard({
  plan,
  selected,
  onSelect,
  highlighted,
  locked,
  lockedLabel = "Opens after beta",
}: PlanSelectionCardProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (locked) {
          betaTracker.planUpgradeBlocked({ reason: "beta", plan_name: plan.name });
          return;
        }
        onSelect();
      }}
      aria-disabled={locked || undefined}
      className={cn(
        "relative w-full rounded-2xl border p-5 text-left transition-all sm:p-6",
        selected
          ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
          : "border-gray-800 bg-gradient-to-br from-gray-900 to-black hover:border-gray-700",
        highlighted && !selected && "border-primary/40",
        locked && "cursor-not-allowed opacity-60 hover:border-gray-800"
      )}
    >
      {locked ? (
        <span className="absolute -top-3 left-4 rounded-full border border-gray-700 bg-gray-900 px-3 py-0.5 text-xs font-semibold text-gray-400">
          {lockedLabel}
        </span>
      ) : (
        highlighted && (
          <span className="absolute -top-3 left-4 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-white">
            Recommended
          </span>
        )
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
  lockPaidPlans?: boolean;
  lockedLabel?: string;
};

export function PlanSelectionGrid({
  plans,
  selectedId = "",
  onSelect,
  lockPaidPlans,
  lockedLabel = "Opens after beta",
}: PlanSelectionGridProps) {
  const paidSorted = [...plans].sort((a, b) => a.price - b.price);
  const recommendedId =
    paidSorted.find((p) => !isFreePlan(p))?._id ?? paidSorted[Math.min(1, paidSorted.length - 1)]?._id;

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {paidSorted.map((plan) => {
        const locked = Boolean(lockPaidPlans && !isFreePlan(plan));
        return (
          <PlanSelectionCard
            key={plan._id}
            plan={plan}
            selected={selectedId === plan._id}
            highlighted={!locked && plan._id === recommendedId && !isFreePlan(plan)}
            locked={locked}
            lockedLabel={lockedLabel}
            onSelect={() => {
              if (!locked) onSelect?.(plan._id);
            }}
          />
        );
      })}
    </div>
  );
}

/** Compact stacked list for the onboarding column (max-w-md). */
export function PlanSelectionList({
  plans,
  selectedId = "",
  onSelect,
  lockPaidPlans,
  lockedLabel = "Opens after beta",
}: PlanSelectionGridProps) {
  const paidSorted = [...plans].sort((a, b) => a.price - b.price);
  const recommendedId = paidSorted.find((p) => !isFreePlan(p))?._id;

  return (
    <div className="grid gap-2">
      {paidSorted.map((plan) => {
        const selected = selectedId === plan._id;
        const locked = Boolean(lockPaidPlans && !isFreePlan(plan));
        const recommended = !locked && plan._id === recommendedId && !isFreePlan(plan);
        const features = plan.features?.length ? plan.features.slice(0, 3).join(" · ") : "Core Bloggr features";
        return (
          <button
            key={plan._id}
            type="button"
            aria-disabled={locked || undefined}
            onClick={() => {
              if (locked) {
                betaTracker.planUpgradeBlocked({ reason: "beta", plan_name: plan.name });
                return;
              }
              onSelect?.(plan._id);
            }}
            className={cn(
              "rounded-lg border px-4 py-3 text-left transition-colors",
              selected
                ? "border-primary bg-primary/15 text-white"
                : "border-gray-700 bg-gray-900/50 text-gray-300 hover:border-gray-600",
              locked && "cursor-not-allowed opacity-60 hover:border-gray-700"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium text-white">{plan.name}</span>
                  {locked ? (
                    <span className="rounded-full border border-gray-700 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                      {lockedLabel}
                    </span>
                  ) : (
                    recommended && (
                      <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        Recommended
                      </span>
                    )
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">{features}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold text-white">{formatPriceLabel(plan)}</p>
                {intervalSuffix(plan) && <p className="text-xs text-gray-500">{intervalSuffix(plan)}</p>}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

type PlanContinueButtonProps = {
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  label?: string;
};

export function PlanContinueButton({ onClick, disabled, loading, label = "Continue" }: PlanContinueButtonProps) {
  return (
    <Button
      className="w-full bg-primary text-white hover:bg-primary/90"
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? "Continuing..." : label}
    </Button>
  );
}

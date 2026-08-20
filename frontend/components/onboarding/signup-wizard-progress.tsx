"use client";

import Link from "next/link";
import type { SignupWizardStage } from "@/lib/onboarding/signup-wizard";
import { previousWizardPath } from "@/lib/onboarding/signup-wizard";
import { WizardHomeLink } from "@/components/onboarding/wizard-home-link";

const STEPS: Array<{ stage: Exclude<SignupWizardStage, "complete" | "strategist_ready">; label: string }> = [
  { stage: "email_verification", label: "Verify" },
  { stage: "company_role", label: "Role" },
  { stage: "plan_selection", label: "Plan" },
  { stage: "workspace_name", label: "Workspace" },
  { stage: "strategist_setup", label: "Setup" },
  { stage: "invite", label: "Invite" },
];

function stepIndex(stage: Exclude<SignupWizardStage, "complete">): number {
  if (stage === "strategist_ready") {
    return STEPS.findIndex((s) => s.stage === "strategist_setup");
  }
  const index = STEPS.findIndex((s) => s.stage === stage);
  return index >= 0 ? index : STEPS.length - 1;
}

export function SignupWizardProgress({
  stage,
  siteId,
  hideBack = false,
}: {
  stage: Exclude<SignupWizardStage, "complete">;
  siteId?: string;
  hideBack?: boolean;
}) {
  const current = stepIndex(stage);
  const stepNumber = current + 1;
  const backHref = previousWizardPath(stage, siteId);

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between gap-3 text-sm">
        {hideBack ? (
          <span />
        ) : (
          <Link
            href={backHref}
            className="text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
          >
            ← Back
          </Link>
        )}
        <p className="text-gray-500">
          Step {stepNumber} of {STEPS.length}
        </p>
        <WizardHomeLink className="text-gray-400 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm disabled:opacity-60">
          Home
        </WizardHomeLink>
      </div>
      <ol className="flex items-center gap-1" aria-label="Signup progress">
        {STEPS.map((step, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <li key={step.stage} className="flex flex-1 items-center gap-1 min-w-0">
              <div className="flex w-full flex-col items-center gap-1">
                <div
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    done || active ? "bg-primary" : "bg-gray-800"
                  } ${active ? "ring-1 ring-primary/40" : ""}`}
                  aria-current={active ? "step" : undefined}
                />
                <span
                  className={`hidden truncate text-[10px] sm:block ${
                    active ? "text-primary" : done ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {step.label}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

"use client";

import type { SignupWizardStage } from "@/lib/onboarding/signup-wizard";

const STEPS: Array<{ stage: Exclude<SignupWizardStage, "complete">; label: string }> = [
  { stage: "email_verification", label: "Verify" },
  { stage: "company_role", label: "Role" },
  { stage: "workspace_name", label: "Workspace" },
  { stage: "plan_selection", label: "Plan" },
  { stage: "invite", label: "Invite" },
];

function stepIndex(stage: Exclude<SignupWizardStage, "complete">): number {
  return STEPS.findIndex((s) => s.stage === stage);
}

export function SignupWizardProgress({
  stage,
}: {
  stage: Exclude<SignupWizardStage, "complete">;
}) {
  const current = stepIndex(stage);
  const stepNumber = current + 1;

  return (
    <div className="mb-6">
      <p className="mb-3 text-sm text-gray-500">
        Step {stepNumber} of {STEPS.length}
      </p>
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

import { describe, expect, it } from "@jest/globals";

/**
 * Mirrors frontend/lib/onboarding/signup-wizard.ts so stage routing stays aligned.
 */
type SignupWizardStage =
  | "email_verification"
  | "company_role"
  | "plan_selection"
  | "workspace_name"
  | "invite"
  | "strategist_setup"
  | "strategist_ready"
  | "complete";

const SIGNUP_WIZARD_ORDER: SignupWizardStage[] = [
  "email_verification",
  "company_role",
  "plan_selection",
  "workspace_name",
  "strategist_setup",
  "strategist_ready",
  "invite",
  "complete",
];

function signupWizardPath(status: { stage: string; site_id?: string }): string {
  const siteQuery = status.site_id ? `?siteId=${encodeURIComponent(status.site_id)}` : "";
  switch (status.stage) {
    case "email_verification":
      return "/auth/verify-email";
    case "company_role":
      return "/onboarding/company-role";
    case "plan_selection":
      return `/onboarding/plans${siteQuery}`;
    case "workspace_name":
      return `/onboarding/create-site${siteQuery}`;
    case "invite":
      return `/onboarding/invite${siteQuery}`;
    case "strategist_setup":
      return `/onboarding/setup${siteQuery}`;
    case "strategist_ready":
      return `/onboarding/invite${siteQuery}`;
    case "complete":
    default:
      return "/dashboard";
  }
}

function stageIndex(stage: SignupWizardStage): number {
  const index = SIGNUP_WIZARD_ORDER.indexOf(stage);
  return index >= 0 ? index : SIGNUP_WIZARD_ORDER.length - 1;
}

function canVisitStage(page: SignupWizardStage, current: SignupWizardStage): boolean {
  if (current === "complete") return false;
  if (page === "email_verification") return current === "email_verification";
  if (page === "invite" && current === "strategist_ready") return true;
  return stageIndex(page) <= stageIndex(current);
}

function previousWizardPath(stage: SignupWizardStage, siteId?: string): string {
  const siteQuery = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  switch (stage) {
    case "plan_selection":
      return "/onboarding/company-role";
    case "workspace_name":
      return `/onboarding/plans${siteQuery}`;
    case "strategist_setup":
      return `/onboarding/create-site${siteQuery}`;
    case "strategist_ready":
      return `/onboarding/setup${siteQuery}`;
    case "invite":
      return `/onboarding/setup${siteQuery}`;
    default:
      return "/";
  }
}

function nextWizardPath(page: SignupWizardStage, siteId?: string): string {
  const siteQuery = siteId ? `?siteId=${encodeURIComponent(siteId)}` : "";
  switch (page) {
    case "company_role":
      return "/onboarding/plans";
    case "plan_selection":
      return `/onboarding/create-site${siteQuery}`;
    case "workspace_name":
      return `/onboarding/setup${siteQuery}`;
    case "strategist_setup":
    case "strategist_ready":
      return `/onboarding/invite${siteQuery}`;
    default:
      return "/";
  }
}

describe("signup wizard paths", () => {
  it("routes plan before workspace and invite after setup/ready", () => {
    expect(signupWizardPath({ stage: "plan_selection" })).toBe("/onboarding/plans");
    expect(signupWizardPath({ stage: "workspace_name" })).toBe("/onboarding/create-site");
    expect(signupWizardPath({ stage: "strategist_setup", site_id: "s1" })).toBe("/onboarding/setup?siteId=s1");
    expect(signupWizardPath({ stage: "strategist_ready", site_id: "s1" })).toBe("/onboarding/invite?siteId=s1");
    expect(signupWizardPath({ stage: "invite", site_id: "s1" })).toBe("/onboarding/invite?siteId=s1");
    expect(signupWizardPath({ stage: "complete" })).toBe("/dashboard");
  });

  it("allows visiting earlier steps but not skipping ahead", () => {
    expect(canVisitStage("workspace_name", "strategist_setup")).toBe(true);
    expect(canVisitStage("invite", "strategist_setup")).toBe(false);
    expect(canVisitStage("invite", "strategist_ready")).toBe(true);
    expect(canVisitStage("email_verification", "company_role")).toBe(false);
    expect(canVisitStage("company_role", "complete")).toBe(false);
  });

  it("sends back to the landing page from early steps", () => {
    expect(previousWizardPath("email_verification")).toBe("/");
    expect(previousWizardPath("company_role")).toBe("/");
    expect(previousWizardPath("plan_selection")).toBe("/onboarding/company-role");
    expect(previousWizardPath("invite", "s1")).toBe("/onboarding/setup?siteId=s1");
  });

  it("always continues to the next tab, never skipping ahead", () => {
    expect(nextWizardPath("plan_selection", "s1")).toBe("/onboarding/create-site?siteId=s1");
    expect(nextWizardPath("workspace_name", "s1")).toBe("/onboarding/setup?siteId=s1");
    expect(nextWizardPath("strategist_setup", "s1")).toBe("/onboarding/invite?siteId=s1");
  });
});

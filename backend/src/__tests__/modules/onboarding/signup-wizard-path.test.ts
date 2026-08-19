import { describe, expect, it } from "@jest/globals";

/**
 * Mirrors frontend/lib/onboarding/signup-wizard.ts so stage routing stays aligned.
 */
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
      return "/onboarding/create-site";
    case "invite":
      return `/onboarding/invite${siteQuery}`;
    case "strategist_setup":
      return `/onboarding/setup${siteQuery}`;
    case "strategist_ready":
      return `/onboarding/ready${siteQuery}`;
    case "complete":
    default:
      return "/dashboard";
  }
}

describe("signup wizard paths", () => {
  it("routes plan before workspace and setup/ready after invite", () => {
    expect(signupWizardPath({ stage: "plan_selection" })).toBe("/onboarding/plans");
    expect(signupWizardPath({ stage: "workspace_name" })).toBe("/onboarding/create-site");
    expect(signupWizardPath({ stage: "invite", site_id: "s1" })).toBe("/onboarding/invite?siteId=s1");
    expect(signupWizardPath({ stage: "strategist_setup", site_id: "s1" })).toBe("/onboarding/setup?siteId=s1");
    expect(signupWizardPath({ stage: "strategist_ready", site_id: "s1" })).toBe("/onboarding/ready?siteId=s1");
    expect(signupWizardPath({ stage: "complete" })).toBe("/dashboard");
  });
});

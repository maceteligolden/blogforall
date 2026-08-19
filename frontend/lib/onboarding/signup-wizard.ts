export type SignupWizardStage =
  | "email_verification"
  | "company_role"
  | "plan_selection"
  | "workspace_name"
  | "invite"
  | "strategist_setup"
  | "strategist_ready"
  | "complete";

export type SignupWizardStatus = {
  stage: SignupWizardStage;
  site_id?: string;
};

export function signupWizardPath(status: SignupWizardStatus): string {
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

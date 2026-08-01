export type SignupWizardStage =
  | "email_verification"
  | "company_role"
  | "workspace_name"
  | "plan_selection"
  | "invite"
  | "complete";

export type SignupWizardStatus = {
  stage: SignupWizardStage;
  site_id?: string;
};

export function signupWizardPath(status: SignupWizardStatus): string {
  switch (status.stage) {
    case "email_verification":
      return "/auth/verify-email";
    case "company_role":
      return "/onboarding/company-role";
    case "workspace_name":
      return "/onboarding/create-site";
    case "plan_selection":
      return status.site_id
        ? `/onboarding/plans?siteId=${encodeURIComponent(status.site_id)}`
        : "/onboarding/plans";
    case "invite":
      return status.site_id
        ? `/onboarding/invite?siteId=${encodeURIComponent(status.site_id)}`
        : "/onboarding/invite";
    case "complete":
    default:
      return "/dashboard";
  }
}

export type SignupWizardStage = "workspace_name" | "business_chat" | "plan_selection" | "invite" | "complete";

export type SignupWizardStatus = {
  stage: SignupWizardStage;
  site_id?: string;
};

export function signupWizardPath(status: SignupWizardStatus): string {
  switch (status.stage) {
    case "workspace_name":
      return "/onboarding/create-site";
    case "business_chat":
      return status.site_id
        ? `/onboarding/create-site?step=chat&siteId=${encodeURIComponent(status.site_id)}`
        : "/onboarding/create-site?step=chat";
    case "plan_selection":
      return status.site_id ? `/onboarding/plans?siteId=${encodeURIComponent(status.site_id)}` : "/onboarding/plans";
    case "invite":
      return status.site_id ? `/onboarding/invite?siteId=${encodeURIComponent(status.site_id)}` : "/onboarding/invite";
    case "complete":
    default:
      return "/dashboard";
  }
}

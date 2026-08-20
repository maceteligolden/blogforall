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
  website_url_invalid?: boolean;
  website_url?: string;
};

/** Linear signup order after the generation-before-invite change. */
export const SIGNUP_WIZARD_ORDER: SignupWizardStage[] = [
  "email_verification",
  "company_role",
  "plan_selection",
  "workspace_name",
  "strategist_setup",
  "strategist_ready",
  "invite",
  "complete",
];

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

/** Allow the current step or any earlier completed step; never skip ahead. */
export function canVisitStage(page: SignupWizardStage, current: SignupWizardStage): boolean {
  if (current === "complete") return false;
  if (page === "email_verification") return current === "email_verification";
  if (page === "invite" && current === "strategist_ready") return true;
  return stageIndex(page) <= stageIndex(current);
}

/**
 * Immediate next wizard route from this page. Does not skip ahead to a later stage.
 */
export function nextWizardPath(page: SignupWizardStage, siteId?: string): string {
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

/** Previous onboarding route, or the landing page. */
export function previousWizardPath(stage: SignupWizardStage, siteId?: string): string {
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
    case "email_verification":
    case "company_role":
    default:
      return "/";
  }
}

export function signupBootstrapRefreshKey(siteId: string): string {
  return `signup_bootstrap_refresh:${siteId}`;
}

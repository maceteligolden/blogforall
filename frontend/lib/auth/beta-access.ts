export const ACCOUNT_TYPE = {
  STANDARD: "standard",
  BETA: "beta",
} as const;

export type AccountType = (typeof ACCOUNT_TYPE)[keyof typeof ACCOUNT_TYPE];

export function needsBetaApproval(
  user: { account_type?: string | null; is_approved?: boolean | null } | null | undefined
): boolean {
  return user?.account_type === ACCOUNT_TYPE.BETA && user.is_approved === false;
}

export function postOnboardingPath(
  user: { account_type?: string | null; is_approved?: boolean | null } | null | undefined
): "/auth/waiting" | "/dashboard" {
  return needsBetaApproval(user) ? "/auth/waiting" : "/dashboard";
}

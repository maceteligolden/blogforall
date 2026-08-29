export interface SignupInput {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  accept_terms: boolean;
  terms_version?: string;
  referral_code?: string;
  invite_token?: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface UpdateProfileInput {
  first_name?: string;
  last_name?: string;
  phone_number?: string;
}

export interface ChangePasswordInput {
  old_password: string;
  new_password: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface VerifyResetCodeInput {
  email: string;
  code: string;
}

export interface ResetPasswordInput {
  email: string;
  code: string;
  new_password: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginResponse {
  tokens: AuthTokens;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    plan: string;
    role: string;
    email_verified?: boolean;
    company_role?: string;
    account_type: string;
    is_approved: boolean;
  };
  requiresSiteCreation?: boolean;
  requires_email_verification?: boolean;
  requires_company_role?: boolean;
}

export interface VerifyEmailInput {
  code: string;
}

export interface CompanyRoleInput {
  company_role: "founder" | "marketer" | "content" | "engineer" | "agency" | "other";
  company_role_detail?: string;
}

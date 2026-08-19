import { UserRole, UserPlan } from "../constants";
import { BaseEntity } from "../interfaces";

export interface User extends BaseEntity {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  role: UserRole;
  plan: UserPlan;
  sessionToken?: string | null;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  resetPasswordAttempts?: number;
  stripe_customer_id?: string;
  onboarding_completed: boolean;
  terms_accepted_at?: Date;
  terms_version?: string;
  referral_code?: string;
  referred_by_user_id?: string;
  workspace_invite_prompt_dismissed_at?: Date;
  plan_selection_completed_at?: Date;
  strategist_ready_acknowledged_at?: Date;
  email_verified: boolean;
  email_verification_token?: string;
  email_verification_expires?: Date;
  email_verification_attempts?: number;
  company_role?: string;
  company_role_detail?: string;
  welcome_tour_dismissed_at?: Date;
  show_welcome_tour?: boolean;
}

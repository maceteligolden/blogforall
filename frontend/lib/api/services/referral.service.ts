import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export interface ReferralEntry {
  id: string;
  status: string;
  signed_up_at: string;
  referred_email?: string;
  referred_name?: string;
}

export interface ReferralDashboard {
  referral_code: string;
  referral_link: string;
  total_referrals: number;
  reward_per_referral_tokens: number;
  referrals: ReferralEntry[];
}

export class ReferralService {
  static async getDashboard(): Promise<ReferralDashboard> {
    const response = await apiClient.get<{ data: ReferralDashboard }>(API_ENDPOINTS.REFERRALS.ME);
    return response.data.data;
  }
}

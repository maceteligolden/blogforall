import { BaseEntity } from "../interfaces";

export enum ReferralStatus {
  SIGNED_UP = "signed_up",
  REWARDED = "rewarded",
}

export interface Referral extends BaseEntity {
  referrer_user_id: string;
  referred_user_id: string;
  status: ReferralStatus;
}

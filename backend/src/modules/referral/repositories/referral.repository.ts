import { injectable } from "tsyringe";
import ReferralModel, { Referral, ReferralStatus } from "../../../shared/schemas/referral.schema";

@injectable()
export class ReferralRepository {
  async create(data: {
    referrer_user_id: string;
    referred_user_id: string;
    status?: ReferralStatus;
  }): Promise<Referral> {
    const doc = new ReferralModel({
      ...data,
      status: data.status ?? ReferralStatus.SIGNED_UP,
    });
    return doc.save();
  }

  async findByReferredUserId(referredUserId: string): Promise<Referral | null> {
    return ReferralModel.findOne({ referred_user_id: referredUserId });
  }

  async listByReferrerUserId(referrerUserId: string): Promise<Referral[]> {
    return ReferralModel.find({ referrer_user_id: referrerUserId }).sort({ created_at: -1 });
  }

  async countByReferrerUserId(referrerUserId: string): Promise<number> {
    return ReferralModel.countDocuments({ referrer_user_id: referrerUserId });
  }
}

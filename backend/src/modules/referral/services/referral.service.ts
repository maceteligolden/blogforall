import { injectable } from "tsyringe";
import { ReferralRepository } from "../repositories/referral.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import { BadRequestError } from "../../../shared/errors";
import { generateReferralCode, maskEmail } from "../../../shared/utils/referral-code.util";
import { env } from "../../../shared/config/env";
import { logger } from "../../../shared/utils/logger";

const MAX_CODE_ATTEMPTS = 8;

@injectable()
export class ReferralService {
  constructor(
    private readonly referralRepository: ReferralRepository,
    private readonly userRepository: UserRepository
  ) {}

  async ensureReferralCode(userId: string): Promise<string> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new BadRequestError("User not found");
    }
    if (user.referral_code) {
      return user.referral_code;
    }

    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = generateReferralCode();
      const existing = await this.userRepository.findByReferralCode(code);
      if (existing) continue;

      const updated = await this.userRepository.update(userId, { referral_code: code });
      if (updated?.referral_code) {
        return updated.referral_code;
      }
    }

    throw new BadRequestError("Failed to generate referral code");
  }

  async recordReferralOnSignup(referredUserId: string, referralCode?: string): Promise<void> {
    if (!referralCode?.trim()) return;

    const code = referralCode.trim().toUpperCase();
    const referrer = await this.userRepository.findByReferralCode(code);
    if (!referrer?._id) {
      logger.warn("Signup with invalid referral code", { referralCode: code }, "ReferralService");
      return;
    }

    if (referrer._id.toString() === referredUserId) {
      return;
    }

    const existing = await this.referralRepository.findByReferredUserId(referredUserId);
    if (existing) return;

    await this.referralRepository.create({
      referrer_user_id: referrer._id.toString(),
      referred_user_id: referredUserId,
    });

    await this.userRepository.update(referredUserId, {
      referred_by_user_id: referrer._id.toString(),
    });
  }

  async getReferralDashboard(userId: string) {
    const code = await this.ensureReferralCode(userId);
    const referrals = await this.referralRepository.listByReferrerUserId(userId);
    const referredUserIds = referrals.map((r) => r.referred_user_id);
    const referredUsers = await this.userRepository.findByIds(referredUserIds);
    const userById = new Map(referredUsers.map((u) => [u._id!.toString(), u]));

    const baseUrl = env.frontend.baseUrl.replace(/\/$/, "");
    const referralLink = `${baseUrl}/auth/signup?ref=${encodeURIComponent(code)}`;

    return {
      referral_code: code,
      referral_link: referralLink,
      total_referrals: referrals.length,
      reward_per_referral_tokens: 50_000,
      referrals: referrals.map((r) => {
        const referred = userById.get(r.referred_user_id);
        return {
          id: r._id,
          status: r.status,
          signed_up_at: r.created_at,
          referred_email: referred ? maskEmail(referred.email) : undefined,
          referred_name: referred
            ? `${referred.first_name} ${referred.last_name}`.trim()
            : undefined,
        };
      }),
    };
  }
}

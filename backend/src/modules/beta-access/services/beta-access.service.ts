import { injectable } from "tsyringe";
import { UserRepository } from "../../auth/repositories/user.repository";
import { NotificationService } from "../../notification/services/notification.service";
import { NotificationChannel, NotificationType } from "../../../shared/constants/notification.constant";
import { AccountType } from "../../../shared/constants";
import { env } from "../../../shared/config/env";
import { BadRequestError, NotFoundError } from "../../../shared/errors";
import { logger } from "../../../shared/utils/logger";
import { User } from "../../../shared/schemas/user.schema";
import { signBetaApprovalToken, verifyBetaApprovalToken } from "../utils/beta-approval-token";

export interface BetaAccessContext {
  first_name: string;
  last_name: string;
  email: string;
  is_approved: boolean;
  rejected: boolean;
}

export interface BetaAccessDecision {
  first_name: string;
  last_name: string;
  email: string;
  is_approved: boolean;
  rejected: boolean;
  already_decided: boolean;
}

@injectable()
export class BetaAccessService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly notificationService: NotificationService
  ) {}

  async notifyAdminOfSignup(user: User): Promise<void> {
    const userId = user._id!.toString();
    const ttlMs = env.betaAccess.tokenTtlDays * 24 * 60 * 60 * 1000;
    const token = signBetaApprovalToken(userId, env.betaAccess.tokenSecret, { ttlMs });
    const base = env.frontend.baseUrl.replace(/\/$/, "");
    const approveUrl = `${base}/beta-access/approve?token=${encodeURIComponent(token)}`;
    const rejectUrl = `${base}/beta-access/reject?token=${encodeURIComponent(token)}`;

    await this.notificationService.createAndSend({
      channel: NotificationChannel.EMAIL,
      type: NotificationType.BETA_SIGNUP_REQUEST,
      recipientEmail: env.betaAccess.notifyEmail,
      templateParams: {
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        approveUrl,
        rejectUrl,
      },
    });
    logger.info("Beta signup request emailed to admin", { userId, email: user.email }, "BetaAccessService");
  }

  async getContext(token: string): Promise<BetaAccessContext> {
    const user = await this.userFromToken(token);
    return this.toContext(user);
  }

  async approve(token: string): Promise<BetaAccessDecision> {
    const user = await this.userFromToken(token);
    const userId = user._id!.toString();
    if (user.is_approved) {
      return { ...this.toContext(user), already_decided: true };
    }

    const updated = await this.userRepository.update(userId, {
      is_approved: true,
      beta_rejected_at: null,
    });
    const next = updated ?? { ...user, is_approved: true, beta_rejected_at: null };

    const loginUrl = `${env.frontend.baseUrl.replace(/\/$/, "")}/auth/login`;
    const firstName = next.first_name;
    const recipientEmail = next.email;
    setImmediate(() => {
      this.notificationService
        .createAndSend({
          channel: NotificationChannel.EMAIL,
          type: NotificationType.BETA_ACCESS_GRANTED,
          recipientEmail,
          templateParams: { firstName, loginUrl },
        })
        .then(() => {
          logger.info("Beta access granted email sent", { userId, email: recipientEmail }, "BetaAccessService");
        })
        .catch((error: unknown) => {
          const err = error instanceof Error ? error : new Error(String(error));
          logger.error("Failed to send beta access granted email", err, { userId }, "BetaAccessService");
        });
    });

    logger.info("Beta account approved", { userId, email: next.email }, "BetaAccessService");
    return { ...this.toContext(next), already_decided: false };
  }

  async reject(token: string): Promise<BetaAccessDecision> {
    const user = await this.userFromToken(token);
    const userId = user._id!.toString();
    if (user.beta_rejected_at && !user.is_approved) {
      return { ...this.toContext(user), already_decided: true };
    }

    const updated = await this.userRepository.update(userId, {
      is_approved: false,
      beta_rejected_at: new Date(),
    });
    const next = updated ?? { ...user, is_approved: false, beta_rejected_at: new Date() };
    logger.info("Beta account reject recorded", { userId, email: next.email }, "BetaAccessService");
    return { ...this.toContext(next), already_decided: false };
  }

  private async userFromToken(token: string): Promise<User> {
    let userId: string;
    try {
      ({ userId } = verifyBetaApprovalToken(token, env.betaAccess.tokenSecret));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid approval token";
      throw new BadRequestError(message);
    }
    const user = await this.userRepository.findById(userId);
    if (!user) throw new NotFoundError("User not found");
    if (user.account_type !== AccountType.BETA) {
      throw new BadRequestError("This account is not a beta applicant");
    }
    return user;
  }

  private toContext(user: User): BetaAccessContext {
    return {
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      is_approved: user.is_approved === true,
      rejected: Boolean(user.beta_rejected_at) && user.is_approved !== true,
    };
  }
}

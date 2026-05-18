import { injectable } from "tsyringe";
import { SubscriptionService } from "../../subscription/services/subscription.service";
import { env } from "../../../shared/config/env";

const UNLIMITED = -1;

@injectable()
export class TokenAllocationService {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * Resolve daily token budget for an account from the active plan.
   * Returns -1 for unlimited tiers.
   */
  async getDailyAllocation(userId: string): Promise<number> {
    const { plan } = await this.subscriptionService.getActiveSubscription(userId);
    const limits = plan.limits as Record<string, number>;
    const fromPlan = limits.dailyTokens ?? limits.daily_tokens;
    if (typeof fromPlan === "number" && Number.isFinite(fromPlan)) {
      return fromPlan;
    }
    return env.tokenLedger.defaultDailyFree;
  }

  isUnlimited(allocation: number): boolean {
    return allocation === UNLIMITED;
  }
}

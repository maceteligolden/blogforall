import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { BadRequestError } from "../../../shared/errors";
import { SubscriptionStatus } from "../../../shared/schemas/subscription.schema";

jest.mock("../../../shared/schemas/user.schema", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../../shared/analytics/posthog.server", () => ({
  captureServerEvent: jest.fn(),
  ServerAnalyticsEvents: {
    SUBSCRIPTION_CHANGED: "subscription changed",
  },
}));

import User from "../../../shared/schemas/user.schema";
import { SubscriptionService } from "../../../modules/subscription/services/subscription.service";

describe("SubscriptionService restored paid paths", () => {
  const mockFetchActivePlans = jest.fn<() => Promise<Array<Record<string, unknown>>>>();
  const mockFindByIdPlan = jest.fn<() => Promise<Record<string, unknown> | null>>();
  const mockFindByUserId = jest.fn<() => Promise<Record<string, unknown> | null>>();
  const mockUpdate = jest.fn<() => Promise<Record<string, unknown> | null>>();
  const mockSetCancelAtPeriodEnd = jest.fn<() => Promise<unknown>>();
  const mockFindDefaultCard = jest.fn<() => Promise<null>>();

  let service: SubscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
    (User.findById as unknown as { mockResolvedValue: (v: unknown) => void }).mockResolvedValue({
      _id: "u1",
      stripe_customer_id: "cus_1",
    });

    service = new SubscriptionService(
      {
        findByUserId: mockFindByUserId,
        update: mockUpdate,
        findActiveByUserId: jest.fn(),
        create: jest.fn(),
        findById: jest.fn(),
        deleteByUserId: jest.fn(),
      } as never,
      {
        fetchActivePlans: mockFetchActivePlans,
        findById: mockFindByIdPlan,
        update: jest.fn(),
      } as never,
      {
        setCancelAtPeriodEnd: mockSetCancelAtPeriodEnd,
        createSubscription: jest.fn(),
        updateSubscription: jest.fn(),
        cancelSubscription: jest.fn(),
        findOrCreateProduct: jest.fn(),
        createPrice: jest.fn(),
        attachPaymentMethod: jest.fn(),
        setDefaultPaymentMethod: jest.fn(),
        updateSubscriptionPaymentMethod: jest.fn(),
      } as never,
      {
        findDefaultCard: mockFindDefaultCard,
      } as never
    );
  });

  it("getPlansForUser returns all active plans sorted by price", async () => {
    mockFetchActivePlans.mockResolvedValue([
      { _id: "p2", name: "Pro", price: 20, interval: "month", isActive: true },
      { _id: "p0", name: "Free", price: 0, interval: "free", isActive: true },
      { _id: "p1", name: "Starter", price: 5, interval: "month", isActive: true },
    ]);

    const plans = await service.getPlansForUser("u1");

    expect(plans.map((p) => p._id)).toEqual(["p0", "p1", "p2"]);
  });

  it("changePlan to paid without a card throws payment-method error", async () => {
    mockFindByUserId.mockResolvedValue({
      _id: "sub1",
      userId: "u1",
      planId: "p0",
      status: SubscriptionStatus.FREE,
    });
    mockFindByIdPlan.mockResolvedValue({
      _id: "p1",
      name: "Starter",
      price: 5,
      interval: "month",
      isActive: true,
      stripe_price_id: "price_1",
    });
    mockFindDefaultCard.mockResolvedValue(null);

    await expect(service.changePlan("u1", "p1")).rejects.toBeInstanceOf(BadRequestError);
    await expect(service.changePlan("u1", "p1")).rejects.toThrow(/payment method/i);
  });

  it("cancelSubscription rejects free plans", async () => {
    mockFindByUserId.mockResolvedValue({
      _id: "sub1",
      userId: "u1",
      planId: "p0",
      status: SubscriptionStatus.FREE,
    });
    mockFindByIdPlan.mockResolvedValue({
      _id: "p0",
      name: "Free",
      price: 0,
      interval: "free",
      isActive: true,
    });

    await expect(service.cancelSubscription("u1")).rejects.toThrow(/Cannot cancel free/i);
  });

  it("cancelSubscription sets cancelAtPeriodEnd for paid Stripe subs", async () => {
    mockFindByUserId.mockResolvedValue({
      _id: "sub1",
      userId: "u1",
      planId: "p1",
      status: SubscriptionStatus.ACTIVE,
      providerSubscriptionId: "sub_stripe_1",
    });
    mockFindByIdPlan.mockResolvedValue({
      _id: "p1",
      name: "Starter",
      price: 5,
      interval: "month",
      isActive: true,
    });
    mockUpdate.mockResolvedValue({
      _id: "sub1",
      cancelAtPeriodEnd: true,
      planId: "p1",
      status: SubscriptionStatus.ACTIVE,
    });

    const updated = await service.cancelSubscription("u1");

    expect(mockSetCancelAtPeriodEnd).toHaveBeenCalledWith("sub_stripe_1", true);
    expect(mockUpdate).toHaveBeenCalledWith("sub1", { cancelAtPeriodEnd: true });
    expect(updated.cancelAtPeriodEnd).toBe(true);
  });
});

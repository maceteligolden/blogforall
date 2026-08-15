import { beforeEach, describe, expect, it, jest } from "@jest/globals";

import { BillingService } from "../../../modules/billing/services/billing.service";

describe("BillingService restored paths", () => {
  const mockCreateSetupIntent = jest.fn<() => Promise<{ client_secret: string }>>();
  const mockFindByCustomerId = jest.fn<() => Promise<unknown[]>>();
  const mockFindById = jest.fn<() => Promise<unknown>>();

  let service: BillingService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFindById.mockResolvedValue({
      _id: "u1",
      email: "a@b.com",
      first_name: "A",
      last_name: "B",
      stripe_customer_id: "cus_1",
    });
    mockCreateSetupIntent.mockResolvedValue({ client_secret: "seti_secret" });
    mockFindByCustomerId.mockResolvedValue([]);

    service = new BillingService(
      {
        createCustomer: jest.fn(),
        createSetupIntent: mockCreateSetupIntent,
        attachPaymentMethod: jest.fn(),
        retrievePaymentMethod: jest.fn(),
        setDefaultPaymentMethod: jest.fn(),
        deletePaymentMethod: jest.fn(),
        listInvoices: jest.fn(async () => ({ data: [] })),
        getInvoice: jest.fn(),
      } as never,
      {
        findByCustomerId: mockFindByCustomerId,
        create: jest.fn(),
        findById: jest.fn(),
        delete: jest.fn(),
        setAllCardsNonDefault: jest.fn(),
        update: jest.fn(),
      } as never,
      {
        findById: mockFindById,
        update: jest.fn(),
      } as never
    );
  });

  it("initializeAddCard no longer throws billing-disabled Forbidden", async () => {
    const result = await service.initializeAddCard("u1");
    expect(result.client_secret).toBe("seti_secret");
    expect(mockCreateSetupIntent).toHaveBeenCalledWith("cus_1");
  });

  it("fetchUserCards returns cards for Stripe customer", async () => {
    mockFindByCustomerId.mockResolvedValue([{ _id: "card1" }]);
    const cards = await service.fetchUserCards("u1");
    expect(cards).toHaveLength(1);
  });
});

import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { AdminStatsService } from "../../../modules/admin/services/admin-stats.service";

const mockUserCount = jest.fn<() => Promise<number>>();
const mockBlogCount = jest.fn<() => Promise<number>>();
const mockTotalUsage = jest.fn<() => Promise<number>>();

jest.mock("../../../shared/schemas/user.schema", () => ({
  __esModule: true,
  default: {
    countDocuments: () => mockUserCount(),
  },
}));

jest.mock("../../../shared/schemas/blog.schema", () => ({
  __esModule: true,
  default: {
    countDocuments: () => mockBlogCount(),
  },
}));

jest.mock("../../../modules/token-ledger/repositories/token-ledger.repository", () => ({
  TokenLedgerRepository: jest.fn().mockImplementation(() => ({
    getTotalUsageTokens: () => mockTotalUsage(),
  })),
}));

describe("AdminStatsService", () => {
  let service: AdminStatsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AdminStatsService({ getTotalUsageTokens: () => mockTotalUsage() } as any);
  });

  it("returns aggregated dashboard counts", async () => {
    mockUserCount.mockResolvedValueOnce(42).mockResolvedValueOnce(2);
    mockBlogCount.mockResolvedValueOnce(128);
    mockTotalUsage.mockResolvedValueOnce(7890);

    const stats = await service.getDashboardStats();

    expect(stats).toEqual({
      total_users: 42,
      total_blogs: 128,
      total_platform_admins: 2,
      total_token_usage: 7890,
    });
    expect(mockUserCount).toHaveBeenCalledTimes(2);
    expect(mockBlogCount).toHaveBeenCalledTimes(1);
  });
});

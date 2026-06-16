import { injectable } from "tsyringe";
import User from "../../../shared/schemas/user.schema";
import Blog from "../../../shared/schemas/blog.schema";
import { UserRole } from "../../../shared/constants";
import { TokenLedgerRepository } from "../../token-ledger/repositories/token-ledger.repository";

export interface AdminDashboardStats {
  total_users: number;
  total_blogs: number;
  total_platform_admins: number;
  total_token_usage: number;
}

@injectable()
export class AdminStatsService {
  constructor(private readonly tokenLedgerRepository: TokenLedgerRepository) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [total_users, total_blogs, total_platform_admins, total_token_usage] = await Promise.all([
      User.countDocuments({ role: UserRole.USER }),
      Blog.countDocuments({}),
      User.countDocuments({ role: { $in: [UserRole.ADMIN, UserRole.SUPER_ADMIN] } }),
      this.tokenLedgerRepository.getTotalUsageTokens(),
    ]);

    return {
      total_users,
      total_blogs,
      total_platform_admins,
      total_token_usage,
    };
  }
}

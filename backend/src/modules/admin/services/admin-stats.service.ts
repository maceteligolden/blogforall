import { injectable } from "tsyringe";
import { UserRole } from "../../../shared/constants";
import { TokenLedgerRepository } from "../../token-ledger/repositories/token-ledger.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import { BlogRepository } from "../../blog/repositories/blog.repository";

export interface AdminDashboardStats {
  total_users: number;
  total_blogs: number;
  total_platform_admins: number;
  total_token_usage: number;
}

@injectable()
export class AdminStatsService {
  constructor(
    private readonly tokenLedgerRepository: TokenLedgerRepository,
    private readonly userRepository: UserRepository,
    private readonly blogRepository: BlogRepository
  ) {}

  async getDashboardStats(): Promise<AdminDashboardStats> {
    const [total_users, total_blogs, total_platform_admins, total_token_usage] = await Promise.all([
      this.userRepository.countByRole(UserRole.USER),
      this.blogRepository.countAll(),
      this.userRepository.countByRole([UserRole.ADMIN, UserRole.SUPER_ADMIN]),
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

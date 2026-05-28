import { injectable } from "tsyringe";
import Site from "../../../shared/schemas/site.schema";
import { UserRepository } from "../../auth/repositories/user.repository";
import { hashPassword } from "../../../shared/utils/password";
import { BadRequestError } from "../../../shared/errors";
import { UserPlan } from "../../../shared/constants";
import { logger } from "../../../shared/utils/logger";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { CategoryRepository } from "../../category/repositories/category.repository";
import { TokenLedgerRepository } from "../../token-ledger/repositories/token-ledger.repository";
import type {
  AdminDateRangeQueryInput,
  AdminPaginationQueryInput,
  CreatePlatformAdminInput,
} from "../validations/admin.validation";

export interface AdminUserListItem {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  created_at?: Date;
  blogs_created: number;
  categories_count: number;
  token_usage: number;
}

@injectable()
export class AdminUserService {
  constructor(
    private userRepository: UserRepository,
    private blogRepository: BlogRepository,
    private categoryRepository: CategoryRepository,
    private tokenLedgerRepository: TokenLedgerRepository
  ) {}

  async createPlatformAdmin(input: CreatePlatformAdminInput): Promise<{
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
  }> {
    const email = input.email.toLowerCase();

    const existing = await this.userRepository.findByEmail(email);
    if (existing) {
      throw new BadRequestError("User with this email already exists");
    }

    const hashedPassword = await hashPassword(input.password);

    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      first_name: input.first_name,
      last_name: input.last_name,
      role: input.role,
      plan: UserPlan.FREE,
      onboarding_completed: true,
    });

    logger.info("Platform admin user created", { userId: user._id, email, role: input.role }, "AdminUserService");

    return {
      id: user._id!.toString(),
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role: user.role,
    };
  }

  async listUsers(
    query: AdminPaginationQueryInput,
    dateRange: AdminDateRangeQueryInput
  ): Promise<{
    data: AdminUserListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const { data: users, total } = await this.userRepository.findUsersForAdminList(query);
    const userIds = users.map((u) => u._id!.toString());

    const [blogsByAuthor, tokenUsageByUser, ownedSites] = await Promise.all([
      this.blogRepository.countByAuthors(userIds),
      this.tokenLedgerRepository.getUsageTotalsByUsers(userIds, {
        from: dateRange.from ? new Date(dateRange.from) : undefined,
        to: dateRange.to ? new Date(dateRange.to) : undefined,
      }),
      Site.find({ owner: { $in: userIds } }).select("_id owner"),
    ]);

    const siteIds = ownedSites.map((s) => s._id!.toString());
    const siteOwnerMap = ownedSites.reduce<Record<string, string>>((acc, site) => {
      acc[site._id!.toString()] = site.owner;
      return acc;
    }, {});
    const categoriesBySite = await this.categoryRepository.countBySiteIds(siteIds);
    const categoriesByOwner = Object.entries(categoriesBySite).reduce<Record<string, number>>((acc, [siteId, count]) => {
      const ownerId = siteOwnerMap[siteId];
      if (!ownerId) return acc;
      acc[ownerId] = (acc[ownerId] ?? 0) + count;
      return acc;
    }, {});

    const rows: AdminUserListItem[] = users.map((u) => {
      const id = u._id!.toString();
      return {
        id,
        email: u.email,
        first_name: u.first_name,
        last_name: u.last_name,
        created_at: u.created_at,
        blogs_created: blogsByAuthor[id] ?? 0,
        categories_count: categoriesByOwner[id] ?? 0,
        token_usage: tokenUsageByUser[id] ?? 0,
      };
    });

    return {
      data: rows,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }
}

import { injectable } from "tsyringe";
import { TokenLedgerRepository } from "../../token-ledger/repositories/token-ledger.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import type { AdminDateRangeQueryInput } from "../validations/admin.validation";

@injectable()
export class AdminTokenUsageService {
  constructor(
    private readonly tokenLedgerRepository: TokenLedgerRepository,
    private readonly userRepository: UserRepository
  ) {}

  async getSummary(): Promise<{ total_token_usage: number }> {
    const total_token_usage = await this.tokenLedgerRepository.getTotalUsageTokens();
    return { total_token_usage };
  }

  async getDailyUsage(query: AdminDateRangeQueryInput): Promise<Array<{ date: string; tokens: number }>> {
    return this.tokenLedgerRepository.getDailyUsage({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
  }

  async getDailyUsageByUser(
    query: AdminDateRangeQueryInput
  ): Promise<Array<{ date: string; user_id: string; user_name: string; user_email: string; tokens: number }>> {
    const rows = await this.tokenLedgerRepository.getDailyUsageByUser({
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    });
    const users = await this.userRepository.findByIds(Array.from(new Set(rows.map((r) => r.user_id))));
    const userMap = users.reduce<Record<string, { email: string; name: string }>>((acc, user) => {
      acc[user._id!.toString()] = {
        email: user.email,
        name: `${user.first_name} ${user.last_name}`.trim(),
      };
      return acc;
    }, {});

    return rows.map((row) => ({
      date: row.date,
      user_id: row.user_id,
      user_name: userMap[row.user_id]?.name ?? "Unknown user",
      user_email: userMap[row.user_id]?.email ?? "-",
      tokens: row.tokens,
    }));
  }
}

import { useQuery } from "@tanstack/react-query";
import { ReferralService } from "@/lib/api/services/referral.service";
import { QUERY_KEYS } from "@/lib/api/config";

export function useReferralDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.REFERRALS,
    queryFn: () => ReferralService.getDashboard(),
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SubscriptionService } from "@/lib/api/services/subscription.service";
import { QUERY_KEYS } from "@/lib/api/config";

export function useSubscription() {
  return useQuery({
    queryKey: QUERY_KEYS.SUBSCRIPTION,
    queryFn: () => SubscriptionService.getSubscription(),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: QUERY_KEYS.PLANS,
    queryFn: () => SubscriptionService.getPlans(),
  });
}

export function useChangePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (planId: string) => SubscriptionService.changePlan(planId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PLANS });
    },
  });
}

export function useCancelSubscription() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => SubscriptionService.cancelSubscription(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SUBSCRIPTION });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CampaignService, CreateScheduledPostRequest, ScheduledPost } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";

export function useScheduledPosts(params?: {
  campaign_id?: string;
  status?: string;
  scheduled_at_from?: string;
  scheduled_at_to?: string;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.MY_SCHEDULED_POSTS, params],
    queryFn: async () => {
      const response = await CampaignService.getScheduledPosts(params);
      return response.data?.data || [];
    },
  });
}

export function useAllScheduledPosts(params?: {
  campaign_id?: string;
  status?: string;
  scheduled_at_from?: string;
  scheduled_at_to?: string;
  page?: number;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...QUERY_KEYS.SCHEDULED_POSTS, params],
    queryFn: async () => {
      const response = await CampaignService.getAllScheduledPosts(params);
      // Handle paginated response
      if (response.data?.data) {
        return Array.isArray(response.data.data) ? response.data.data : [];
      }
      if (Array.isArray(response.data)) {
        return response.data;
      }
      return [];
    },
  });
}

export function useScheduledPost(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.SCHEDULED_POST(id),
    queryFn: async () => {
      const response = await CampaignService.getScheduledPostById(id);
      return response.data?.data;
    },
    enabled: !!id,
  });
}

export function useCreateScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateScheduledPostRequest) => CampaignService.createScheduledPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
    },
  });
}

export function useUpdateScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateScheduledPostRequest> }) =>
      CampaignService.updateScheduledPost(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POST(variables.id) });
    },
  });
}

export function useDeleteScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CampaignService.deleteScheduledPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
    },
  });
}

export function useCancelScheduledPost() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CampaignService.cancelScheduledPost(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
    },
  });
}

export function useMoveToCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, campaignId }: { id: string; campaignId: string }) =>
      CampaignService.moveToCampaign(id, campaignId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGNS });
    },
  });
}

export function useRemoveFromCampaign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CampaignService.removeFromCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.SCHEDULED_POSTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGNS });
    },
  });
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CampaignService, CreateCampaignRequest, UpdateCampaignRequest, Campaign, CampaignQueryParams } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useToast } from "@/components/ui/toast";

export function useCampaigns(params?: CampaignQueryParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.MY_CAMPAIGNS, params],
    queryFn: () => CampaignService.getCampaigns(params),
  });
}

export function useCampaign(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN(id),
    queryFn: () => CampaignService.getCampaignById(id),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: CreateCampaignRequest) => CampaignService.createCampaign(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_CAMPAIGNS });
      toast({
        title: "Success",
        description: "Campaign created successfully",
        variant: "success",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to create campaign";
      toast({
        title: "Error",
        description: message,
        variant: "error",
      });
    },
  });
}

export function useUpdateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCampaignRequest }) =>
      CampaignService.updateCampaign(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_CAMPAIGNS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(variables.id) });
      toast({
        title: "Success",
        description: "Campaign updated successfully",
        variant: "success",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to update campaign";
      toast({
        title: "Error",
        description: message,
        variant: "error",
      });
    },
  });
}

export function useDeleteCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => CampaignService.deleteCampaign(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_CAMPAIGNS });
      toast({
        title: "Success",
        description: "Campaign deleted successfully",
        variant: "success",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to delete campaign";
      toast({
        title: "Error",
        description: message,
        variant: "error",
      });
    },
  });
}

export function useActivateCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => CampaignService.activateCampaign(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_CAMPAIGNS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(id) });
      toast({
        title: "Success",
        description: "Campaign activated successfully",
        variant: "success",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to activate campaign";
      toast({
        title: "Error",
        description: message,
        variant: "error",
      });
    },
  });
}

export function usePauseCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => CampaignService.pauseCampaign(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_CAMPAIGNS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(id) });
      toast({
        title: "Success",
        description: "Campaign paused successfully",
        variant: "success",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to pause campaign";
      toast({
        title: "Error",
        description: message,
        variant: "error",
      });
    },
  });
}

export function useCancelCampaign() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => CampaignService.cancelCampaign(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_CAMPAIGNS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CAMPAIGN(id) });
      toast({
        title: "Success",
        description: "Campaign cancelled successfully",
        variant: "success",
      });
    },
    onError: (err: any) => {
      const message = err?.response?.data?.message || "Failed to cancel campaign";
      toast({
        title: "Error",
        description: message,
        variant: "error",
      });
    },
  });
}

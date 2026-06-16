import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiKeyService, CreateApiKeyRequest } from "../api/services/api-key.service";
import { QUERY_KEYS } from "../api/config";

export function useApiKeys(siteId: string | undefined) {
  return useQuery({
    queryKey: siteId ? QUERY_KEYS.API_KEYS(siteId) : ["api-keys", "none"],
    queryFn: async () => {
      const response = await ApiKeyService.getApiKeys(siteId!);
      return response.data.data;
    },
    enabled: Boolean(siteId),
  });
}

export function useCreateApiKey(siteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => {
      if (!siteId) throw new Error("No workspace selected");
      return ApiKeyService.createApiKey(siteId, data);
    },
    onSuccess: () => {
      if (siteId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.API_KEYS(siteId) });
      }
    },
  });
}

export function useDeleteApiKey(siteId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accessKeyId: string) => {
      if (!siteId) throw new Error("No workspace selected");
      return ApiKeyService.deleteApiKey(siteId, accessKeyId);
    },
    onSuccess: () => {
      if (siteId) {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.API_KEYS(siteId) });
      }
    },
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiKeyService, CreateApiKeyRequest } from "../api/services/api-key.service";
import { QUERY_KEYS } from "../api/config";

export function useApiKeys() {
  return useQuery({
    queryKey: QUERY_KEYS.API_KEYS,
    queryFn: async () => {
      const response = await ApiKeyService.getApiKeys();
      return response.data.data;
    },
  });
}

export function useCreateApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateApiKeyRequest) => ApiKeyService.createApiKey(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.API_KEYS });
    },
  });
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (accessKeyId: string) => ApiKeyService.deleteApiKey(accessKeyId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.API_KEYS });
    },
  });
}


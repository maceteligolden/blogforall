import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryService, CreateCategoryRequest, UpdateCategoryRequest } from "../api/services/category.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useCategories(params?: { tree?: boolean; include_inactive?: boolean }) {
  const { currentSiteId } = useAuthStore();
  
  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, currentSiteId, params],
    queryFn: async () => {
      const response = await CategoryService.getCategories(params);
      return response.data.data;
    },
    enabled: !!currentSiteId,
  });
}

export function useCategory(id: string) {
  const { currentSiteId } = useAuthStore();
  
  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, currentSiteId, id],
    queryFn: async () => {
      const response = await CategoryService.getCategoryById(id);
      return response.data.data;
    },
    enabled: !!id && !!currentSiteId,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => CategoryService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.CATEGORIES, currentSiteId] });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) =>
      CategoryService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.CATEGORIES, currentSiteId] });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => CategoryService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.CATEGORIES, currentSiteId] });
    },
  });
}


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CategoryService, CreateCategoryRequest, UpdateCategoryRequest } from "../api/services/category.service";
import { QUERY_KEYS } from "../api/config";

export function useCategories(params?: { tree?: boolean; include_inactive?: boolean }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, params],
    queryFn: async () => {
      const response = await CategoryService.getCategories(params);
      return response.data.data;
    },
  });
}

export function useCategory(id: string) {
  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, id],
    queryFn: async () => {
      const response = await CategoryService.getCategoryById(id);
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCategoryRequest) => CategoryService.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

export function useUpdateCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoryRequest }) =>
      CategoryService.updateCategory(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

export function useDeleteCategory() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CategoryService.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}


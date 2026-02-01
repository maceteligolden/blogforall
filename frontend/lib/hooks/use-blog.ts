import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BlogService,
  CreateBlogRequest,
  UpdateBlogRequest,
  BlogQueryParams,
} from "../api/services/blog.service";
import { QUERY_KEYS } from "../api/config";
import { useAuthStore } from "../store/auth.store";

export function useBlogs(params?: BlogQueryParams) {
  const { currentSiteId } = useAuthStore();
  
  return useQuery({
    queryKey: [...QUERY_KEYS.BLOGS, currentSiteId, params],
    queryFn: async () => {
      const response = await BlogService.getUserBlogs(params);
      return response.data.data;
    },
    enabled: !!currentSiteId,
  });
}

export function useBlog(id: string) {
  const { currentSiteId } = useAuthStore();
  
  return useQuery({
    queryKey: [...QUERY_KEYS.BLOG(id), currentSiteId],
    queryFn: async () => {
      const response = await BlogService.getBlogById(id);
      return response.data.data;
    },
    enabled: !!id && !!currentSiteId,
  });
}

export function useCreateBlog() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (data: CreateBlogRequest) => BlogService.createBlog(data),
    onSuccess: (response) => {
      const blog = response.data.data;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOGS, currentSiteId] });
      router.push(`/dashboard/blogs/${blog._id}`);
    },
  });
}

export function useUpdateBlog() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlogRequest }) =>
      BlogService.updateBlog(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOG(variables.id), currentSiteId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOGS, currentSiteId] });
      // Optionally redirect to view page after update
      // router.push(`/dashboard/blogs/${variables.id}/view`);
    },
  });
}

export function useDeleteBlog() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => BlogService.deleteBlog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOGS, currentSiteId] });
      router.push("/dashboard/blogs");
    },
  });
}

export function usePublishBlog() {
  const queryClient = useQueryClient();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => BlogService.publishBlog(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOG(id), currentSiteId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOGS, currentSiteId] });
    },
  });
}

export function useUnpublishBlog() {
  const queryClient = useQueryClient();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => BlogService.unpublishBlog(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOG(id), currentSiteId] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOGS, currentSiteId] });
    },
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: (file: File) => BlogService.uploadImage(file),
    onError: (error: unknown) => {
      console.error("Image upload failed:", error);
    },
  });
}

export function useToggleBlogLike() {
  const queryClient = useQueryClient();
  const { currentSiteId } = useAuthStore();

  return useMutation({
    mutationFn: (id: string) => BlogService.toggleLike(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOG(id), currentSiteId] });
      queryClient.invalidateQueries({ queryKey: [...QUERY_KEYS.BLOGS, currentSiteId] });
    },
  });
}


import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import {
  BlogService,
  CreateBlogRequest,
  UpdateBlogRequest,
  BlogQueryParams,
} from "../api/services/blog.service";
import { QUERY_KEYS } from "../api/config";

export function useBlogs(params?: BlogQueryParams) {
  return useQuery({
    queryKey: [...QUERY_KEYS.BLOGS, params],
    queryFn: async () => {
      const response = await BlogService.getUserBlogs(params);
      return response.data.data;
    },
  });
}

export function useBlog(id: string) {
  return useQuery({
    queryKey: QUERY_KEYS.BLOG(id),
    queryFn: async () => {
      const response = await BlogService.getBlogById(id);
      return response.data.data;
    },
    enabled: !!id,
  });
}

export function useCreateBlog() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (data: CreateBlogRequest) => BlogService.createBlog(data),
    onSuccess: (response) => {
      const blog = response.data.data;
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
      router.push(`/dashboard/blogs/${blog._id}`);
    },
  });
}

export function useUpdateBlog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateBlogRequest }) =>
      BlogService.updateBlog(id, data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(variables.id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
    },
  });
}

export function useDeleteBlog() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (id: string) => BlogService.deleteBlog(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
      router.push("/dashboard/blogs");
    },
  });
}

export function usePublishBlog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => BlogService.publishBlog(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
    },
  });
}

export function useUnpublishBlog() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => BlogService.unpublishBlog(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MY_BLOGS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
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

  return useMutation({
    mutationFn: (id: string) => BlogService.toggleLike(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOG(id) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.BLOGS });
    },
  });
}


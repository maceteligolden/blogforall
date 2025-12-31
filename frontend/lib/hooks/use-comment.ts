import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CommentService, CreateCommentRequest } from "../api/services/comment.service";
import { QUERY_KEYS } from "../api/config";

export function useCommentsByBlog(blogId: string, params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...QUERY_KEYS.COMMENTS_BY_BLOG(blogId), params],
    queryFn: async () => {
      const response = await CommentService.getCommentsByBlog(blogId, params);
      return response.data.data;
    },
    enabled: !!blogId,
  });
}

export function useCommentReplies(commentId: string) {
  return useQuery({
    queryKey: QUERY_KEYS.COMMENT_REPLIES(commentId),
    queryFn: async () => {
      const response = await CommentService.getCommentReplies(commentId);
      return response.data.data;
    },
    enabled: !!commentId,
  });
}

export function useCreateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateCommentRequest) => CommentService.createComment(data),
    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COMMENTS_BY_BLOG(variables.blog) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COMMENTS });
    },
  });
}

export function useUpdateComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: { content: string } }) =>
      CommentService.updateComment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COMMENTS });
    },
  });
}

export function useDeleteComment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CommentService.deleteComment(id),
    onSuccess: (response, id) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COMMENTS });
      // Invalidate all blog comment queries
      queryClient.invalidateQueries({ queryKey: ["comments", "blog"] });
    },
  });
}

export function useToggleCommentLike() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => CommentService.toggleLike(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.COMMENTS });
    },
  });
}


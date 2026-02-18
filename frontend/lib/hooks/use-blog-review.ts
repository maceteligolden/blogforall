import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BlogReviewService,
  ReviewBlogRequest,
  ApplyReviewRequest,
  ApplyOneRequest,
} from "@/lib/api/services/blog-review.service";
import { useToast } from "@/components/ui/toast";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";

export function useBlogReview() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);

  const reviewMutation = useMutation({
    mutationFn: ({ blogId, data }: { blogId?: string; data?: ReviewBlogRequest }) =>
      BlogReviewService.reviewBlog(blogId, data),
    onError: (error: any) => {
      toast({
        title: "Review Failed",
        description: error.response?.data?.message || "Failed to review blog post",
        variant: "error",
      });
    },
  });

  const applyReviewMutation = useMutation({
    mutationFn: ({ blogId, data }: { blogId: string | undefined; data: ApplyReviewRequest }) => {
      if (!blogId) {
        throw new Error("Blog ID is required to apply review");
      }
      return BlogReviewService.applyReview(blogId, data);
    },
    onSuccess: (_, variables) => {
      if (variables.blogId) {
        queryClient.invalidateQueries({
          queryKey: [...QUERY_KEYS.BLOG(variables.blogId), currentSiteId ?? ""],
        });
      }
      toast({
        title: "Success",
        description: "Review suggestions applied successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Apply Failed",
        description: error.response?.data?.message || "Failed to apply review suggestions",
        variant: "error",
      });
    },
  });

  const applyOneMutation = useMutation({
    mutationFn: ({ blogId, data }: { blogId: string; data: ApplyOneRequest }) =>
      BlogReviewService.applyOne(blogId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.BLOG(variables.blogId), currentSiteId ?? ""],
      });
      toast({
        title: "Applied",
        description: "Suggestion applied. Use version history to undo.",
        variant: "success",
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: "Apply Failed",
        description: err.response?.data?.message || "Failed to apply suggestion",
        variant: "error",
      });
    },
  });

  const restoreVersionMutation = useMutation({
    mutationFn: ({ blogId, version }: { blogId: string; version: number }) =>
      BlogReviewService.restoreVersion(blogId, version),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...QUERY_KEYS.BLOG(variables.blogId), currentSiteId ?? ""],
      });
      toast({
        title: "Success",
        description: "Version restored successfully",
        variant: "success",
      });
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } };
      toast({
        title: "Restore Failed",
        description: err.response?.data?.message || "Failed to restore version",
        variant: "error",
      });
    },
  });

  return {
    reviewBlog: reviewMutation.mutate,
    reviewBlogAsync: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
    reviewResult: reviewMutation.data?.data?.data,
    applyReview: applyReviewMutation.mutate,
    applyReviewAsync: applyReviewMutation.mutateAsync,
    isApplying: applyReviewMutation.isPending,
    applyOne: applyOneMutation.mutate,
    applyOneAsync: applyOneMutation.mutateAsync,
    isApplyingOne: applyOneMutation.isPending,
    restoreVersion: restoreVersionMutation.mutate,
    restoreVersionAsync: restoreVersionMutation.mutateAsync,
    isRestoring: restoreVersionMutation.isPending,
  };
}

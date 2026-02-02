import { useMutation } from "@tanstack/react-query";
import { BlogReviewService, ReviewBlogRequest, ApplyReviewRequest } from "@/lib/api/services/blog-review.service";
import { useToast } from "@/components/ui/toast";

export function useBlogReview() {
  const { toast } = useToast();

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
    onSuccess: () => {
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

  const restoreVersionMutation = useMutation({
    mutationFn: ({ blogId, version }: { blogId: string; version: number }) =>
      BlogReviewService.restoreVersion(blogId, version),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Version restored successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Restore Failed",
        description: error.response?.data?.message || "Failed to restore version",
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
    restoreVersion: restoreVersionMutation.mutate,
    restoreVersionAsync: restoreVersionMutation.mutateAsync,
    isRestoring: restoreVersionMutation.isPending,
  };
}

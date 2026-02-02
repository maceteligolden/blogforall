import { useMutation } from "@tanstack/react-query";
import { BlogGenerationService, PromptAnalysis, GenerateBlogResponse } from "@/lib/api/services/blog-generation.service";
import { useToast } from "@/components/ui/toast";

export function useBlogGeneration() {
  const { toast } = useToast();

  const analyzePromptMutation = useMutation({
    mutationFn: (prompt: string) => BlogGenerationService.analyzePrompt(prompt),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prompt analyzed successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Failed to analyze prompt";
      toast({
        title: "Analysis Failed",
        description: message,
        variant: "error",
      });
    },
  });

  const generateBlogMutation = useMutation({
    mutationFn: ({ prompt, analysis }: { prompt: string; analysis?: PromptAnalysis }) =>
      BlogGenerationService.generateBlog(prompt, analysis),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Blog content generated successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.message || "Failed to generate blog content";
      toast({
        title: "Generation Failed",
        description: message,
        variant: "error",
      });
    },
  });

  return {
    analyzePrompt: analyzePromptMutation.mutateAsync,
    generateBlog: generateBlogMutation.mutateAsync,
    isAnalyzing: analyzePromptMutation.isPending,
    isGenerating: generateBlogMutation.isPending,
    analysisResult: analyzePromptMutation.data?.data?.data,
    generationResult: generateBlogMutation.data?.data?.data,
  };
}

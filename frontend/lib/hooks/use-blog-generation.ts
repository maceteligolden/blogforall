import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import { BlogGenerationService, PromptAnalysis, GenerateBlogResponse } from "@/lib/api/services/blog-generation.service";
import { useToast } from "@/components/ui/toast";

export function useBlogGeneration() {
  const { toast } = useToast();
  const abortControllerRef = useRef<AbortController | null>(null);

  const analyzePromptMutation = useMutation({
    mutationFn: ({ prompt, signal }: { prompt: string; signal?: AbortSignal }) =>
      BlogGenerationService.analyzePrompt(prompt, signal),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Prompt analyzed successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      // Don't show error toast if request was cancelled
      if (error?.name === "AbortError" || error?.code === "ERR_CANCELED") {
        return;
      }
      const message = error?.response?.data?.message || error?.message || "Failed to analyze prompt";
      toast({
        title: "Analysis Failed",
        description: message,
        variant: "error",
      });
    },
  });

  const generateBlogMutation = useMutation({
    mutationFn: ({
      prompt,
      analysis,
      signal,
    }: {
      prompt: string;
      analysis?: PromptAnalysis;
      signal?: AbortSignal;
    }) => BlogGenerationService.generateBlog(prompt, analysis, signal),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Blog content generated successfully",
        variant: "success",
      });
    },
    onError: (error: any) => {
      // Don't show error toast if request was cancelled
      if (error?.name === "AbortError" || error?.code === "ERR_CANCELED") {
        return;
      }
      const message = error?.response?.data?.message || error?.message || "Failed to generate blog content";
      toast({
        title: "Generation Failed",
        description: message,
        variant: "error",
      });
    },
  });

  const cancelRequest = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  };

  const analyzePrompt = async (prompt: string): Promise<PromptAnalysis> => {
    // Cancel any existing request
    cancelRequest();
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    const response = await analyzePromptMutation.mutateAsync({
      prompt,
      signal: abortControllerRef.current.signal,
    });
    
    return response.data.data;
  };

  const generateBlog = async (prompt: string, analysis?: PromptAnalysis): Promise<GenerateBlogResponse> => {
    // Cancel any existing request
    cancelRequest();
    
    // Create new abort controller
    abortControllerRef.current = new AbortController();
    
    const response = await generateBlogMutation.mutateAsync({
      prompt,
      analysis,
      signal: abortControllerRef.current.signal,
    });
    
    return response.data.data;
  };

  return {
    analyzePrompt,
    generateBlog,
    cancelRequest,
    isAnalyzing: analyzePromptMutation.isPending,
    isGenerating: generateBlogMutation.isPending,
    analysisResult: analyzePromptMutation.data?.data?.data,
    generationResult: generateBlogMutation.data?.data?.data,
  };
}

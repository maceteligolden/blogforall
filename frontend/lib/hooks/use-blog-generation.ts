import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import {
  BlogGenerationService,
  PromptAnalysis,
  GenerateBlogResponse,
} from "@/lib/api/services/blog-generation.service";
import { useToast } from "@/components/ui/toast";
import { useInvalidateTokenUsage } from "@/lib/hooks/use-token-usage";
import { useTokenExhaustion } from "@/components/usage/token-exhaustion-provider";
import { generationTracker } from "@/lib/analytics/flows/generation.tracker";
import { extractApiErrorCode } from "@/lib/analytics/extract-error-code";

export function useBlogGeneration() {
  const { toast } = useToast();
  const invalidateTokenUsage = useInvalidateTokenUsage();
  const { showFromError } = useTokenExhaustion();
  const abortControllerRef = useRef<AbortController | null>(null);
  const analyzeStartedAtRef = useRef<number | null>(null);
  const generateStartedAtRef = useRef<number | null>(null);

  const analyzePromptMutation = useMutation({
    mutationFn: ({
      prompt,
      signal,
      hints,
    }: {
      prompt: string;
      signal?: AbortSignal;
      hints?: {
        tone?: string;
        target_audience?: string;
        topics_to_explore?: string[];
        word_count?: number;
        purpose?: string;
        structure?: string;
        length_preset?: "short" | "medium" | "long";
      };
    }) => BlogGenerationService.analyzePrompt(prompt, { signal, ...hints }),
    onSuccess: () => {
      invalidateTokenUsage();
      toast({
        title: "Success",
        description: "Prompt analyzed successfully",
        variant: "success",
      });
    },
    onError: (error: unknown) => {
      const err = error as { name?: string; code?: string; response?: { data?: { message?: string } } };
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
        return;
      }
      const duration_ms =
        analyzeStartedAtRef.current != null ? Date.now() - analyzeStartedAtRef.current : undefined;
      generationTracker.failed({
        stage: "analyze",
        error_code: extractApiErrorCode(error),
        duration_ms,
      });
      if (showFromError(error)) {
        invalidateTokenUsage();
        return;
      }
      const message = err?.response?.data?.message || (err as Error)?.message || "Failed to analyze prompt";
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
    onSuccess: (response) => {
      invalidateTokenUsage();
      const duration_ms =
        generateStartedAtRef.current != null ? Date.now() - generateStartedAtRef.current : 0;
      const content = response?.data?.data?.content?.content;
      const wordCount = content?.split(/\s+/).filter(Boolean).length;
      generationTracker.success({
        stage: "generate",
        duration_ms,
        word_count: wordCount,
      });
      toast({
        title: "Success",
        description: "Blog content generated successfully",
        variant: "success",
      });
    },
    onError: (error: unknown) => {
      const err = error as { name?: string; code?: string; response?: { data?: { message?: string } } };
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
        return;
      }
      const duration_ms =
        generateStartedAtRef.current != null ? Date.now() - generateStartedAtRef.current : undefined;
      generationTracker.failed({
        stage: "generate",
        error_code: extractApiErrorCode(error),
        duration_ms,
      });
      if (showFromError(error)) {
        invalidateTokenUsage();
        return;
      }
      const message = err?.response?.data?.message || (err as Error)?.message || "Failed to generate blog content";
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

  const analyzePrompt = async (
    prompt: string,
    hints?: {
      tone?: string;
      target_audience?: string;
      topics_to_explore?: string[];
      word_count?: number;
      purpose?: string;
      structure?: string;
      length_preset?: "short" | "medium" | "long";
    }
  ): Promise<PromptAnalysis> => {
    cancelRequest();
    abortControllerRef.current = new AbortController();
    analyzeStartedAtRef.current = Date.now();
    generationTracker.started({ stage: "analyze", prompt_length: prompt.length });
    const response = await analyzePromptMutation.mutateAsync({
      prompt,
      signal: abortControllerRef.current.signal,
      hints,
    });
    return response.data.data;
  };

  const generateBlog = async (prompt: string, analysis?: PromptAnalysis): Promise<GenerateBlogResponse> => {
    cancelRequest();
    abortControllerRef.current = new AbortController();
    generateStartedAtRef.current = Date.now();
    generationTracker.started({ stage: "generate", prompt_length: prompt.length });
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

"use client";

import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { AlertCircle, Sparkles, HelpCircle, Info } from "lucide-react";

interface PromptInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  isAnalyzing?: boolean;
  error?: string;
  maxLength?: number;
}

export function PromptInput({
  value,
  onChange,
  onAnalyze,
  isAnalyzing = false,
  error,
  maxLength = 2000,
}: PromptInputProps) {
  const [wordCount, setWordCount] = useState<number | null>(null);
  const [showTips, setShowTips] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    // Extract word count from prompt
    const wordCountMatch = newValue.match(/(\d+)\s*words?/i);
    if (wordCountMatch) {
      setWordCount(parseInt(wordCountMatch[1], 10));
    } else {
      setWordCount(null);
    }
  };

  const handleAnalyze = () => {
    if (value.trim().length === 0) {
      return;
    }
    onAnalyze();
  };

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="prompt" className="text-gray-300 flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          What would you like to write about?
        </Label>
        <Textarea
          id="prompt"
          value={value}
          onChange={handleChange}
          placeholder="e.g., Write a comprehensive guide about React hooks for beginners, approximately 1500 words"
          className="mt-2 bg-black border-gray-700 text-white placeholder:text-gray-500 min-h-[120px]"
          maxLength={maxLength}
          disabled={isAnalyzing}
        />
        <div className="flex items-center justify-between mt-2">
          <div className="text-xs text-gray-500">
            {value.length}/{maxLength} characters
            {wordCount && (
              <span className="ml-2 text-primary">• Target: {wordCount} words</span>
            )}
          </div>
          <Button
            onClick={handleAnalyze}
            disabled={isAnalyzing || value.trim().length === 0}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            {isAnalyzing ? "Analyzing..." : "Analyze Prompt"}
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/20 border border-red-800 p-3 flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-400 font-medium">Invalid Prompt</p>
            <p className="text-xs text-red-300 mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="border border-gray-800 rounded-lg p-4 bg-gray-900/50">
        <button
          type="button"
          onClick={() => setShowTips(!showTips)}
          className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-300 transition-colors w-full"
        >
          <HelpCircle className="w-4 h-4" />
          <span className="font-medium">Tips for better results</span>
          <span className="ml-auto">{showTips ? "−" : "+"}</span>
        </button>
        {showTips && (
          <div className="mt-3 text-xs text-gray-400 space-y-2 pl-6">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                <p className="font-medium text-gray-300 mb-1">Be Specific</p>
                <p>Use specific topics (e.g., &quot;React hooks&quot; instead of &quot;programming&quot;)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                <p className="font-medium text-gray-300 mb-1">Define Your Audience</p>
                <p>Mention target audience (e.g., &quot;for beginners&quot;, &quot;for developers&quot;)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                <p className="font-medium text-gray-300 mb-1">Set Word Count</p>
                <p>Specify desired length (e.g., &quot;approximately 1500 words&quot;)</p>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-400" />
              <div>
                <p className="font-medium text-gray-300 mb-1">Choose Structure</p>
                <p>Include format preference (e.g., &quot;tutorial format&quot;, &quot;listicle&quot;)</p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-800">
              <p className="text-gray-500 italic">
                💡 Tip: Use the &quot;Browse Templates&quot; button for pre-written prompt templates!
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

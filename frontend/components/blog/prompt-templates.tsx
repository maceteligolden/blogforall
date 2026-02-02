"use client";

import { useState } from "react";
import { PROMPT_TEMPLATES, TEMPLATE_CATEGORIES, PromptTemplate, getTemplatesByCategory } from "@/lib/constants/prompt-templates";
import { Button } from "@/components/ui/button";
import { Sparkles, X } from "lucide-react";

interface PromptTemplatesProps {
  onSelectTemplate: (prompt: string) => void;
  onClose: () => void;
}

export function PromptTemplates({ onSelectTemplate, onClose }: PromptTemplatesProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedTemplate, setSelectedTemplate] = useState<PromptTemplate | null>(null);
  const [customizedPrompt, setCustomizedPrompt] = useState("");

  const filteredTemplates = getTemplatesByCategory(selectedCategory);

  const handleTemplateClick = (template: PromptTemplate) => {
    setSelectedTemplate(template);
    // Pre-fill with example if available, otherwise use the template prompt
    setCustomizedPrompt(template.example || template.prompt);
  };

  const handleUseTemplate = () => {
    if (customizedPrompt.trim()) {
      onSelectTemplate(customizedPrompt.trim());
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h2 className="text-xl font-semibold text-white">Prompt Templates</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Category Filter and Template List */}
            <div className="lg:col-span-1 space-y-4">
              {/* Category Filter */}
              <div>
                <label className="text-sm font-medium text-gray-300 mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <button
                      key={category}
                      onClick={() => {
                        setSelectedCategory(category);
                        setSelectedTemplate(null);
                        setCustomizedPrompt("");
                      }}
                      className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                        selectedCategory === category
                          ? "bg-purple-600 text-white"
                          : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </div>
              </div>

              {/* Template List */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300 block">Templates</label>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {filteredTemplates.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateClick(template)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedTemplate?.id === template.id
                          ? "border-purple-600 bg-purple-900/20"
                          : "border-gray-700 bg-gray-800/50 hover:bg-gray-800"
                      }`}
                    >
                      <div className="font-medium text-white text-sm">{template.name}</div>
                      <div className="text-xs text-gray-400 mt-1">{template.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right: Template Preview and Customization */}
            <div className="lg:col-span-2 space-y-4">
              {selectedTemplate ? (
                <>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">{selectedTemplate.name}</h3>
                    <p className="text-sm text-gray-400">{selectedTemplate.description}</p>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-gray-300 mb-2 block">
                      Customize Your Prompt
                    </label>
                    <textarea
                      value={customizedPrompt}
                      onChange={(e) => setCustomizedPrompt(e.target.value)}
                      className="w-full min-h-[200px] rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
                      placeholder="Customize the template prompt..."
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Replace placeholders like {"{topic}"}, {"{option1}"}, {"{count}"} with your actual content.
                    </p>
                  </div>

                  <div className="flex items-center justify-end gap-3">
                    <Button
                      onClick={() => {
                        setSelectedTemplate(null);
                        setCustomizedPrompt("");
                      }}
                      className="border border-gray-700 text-gray-300 hover:bg-gray-800 bg-transparent"
                    >
                      Clear
                    </Button>
                    <Button
                      onClick={handleUseTemplate}
                      disabled={!customizedPrompt.trim()}
                      className="bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      Use This Template
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center h-full min-h-[300px] text-gray-400">
                  <div className="text-center">
                    <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Select a template to get started</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

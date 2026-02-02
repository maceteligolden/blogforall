"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CampaignService, type CampaignTemplate } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, Calendar, Target, TrendingUp } from "lucide-react";
import { useToast } from "@/components/ui/toast";

export default function CampaignTemplatesPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("all");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: [...QUERY_KEYS.CAMPAIGN_TEMPLATES, selectedType],
    queryFn: async () => {
      const response = await CampaignService.getCampaignTemplates(
        selectedType !== "all" ? { type: selectedType } : undefined
      );
      return response.data?.data || [];
    },
  });

  const templateTypes = [
    { value: "all", label: "All Templates" },
    { value: "product_launch", label: "Product Launch" },
    { value: "holiday_campaign", label: "Holiday Campaign" },
    { value: "brand_awareness", label: "Brand Awareness" },
    { value: "lead_generation", label: "Lead Generation" },
    { value: "content_marketing", label: "Content Marketing" },
    { value: "seo_boost", label: "SEO Boost" },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "product_launch":
        return <Sparkles className="w-5 h-5" />;
      case "holiday_campaign":
        return <Calendar className="w-5 h-5" />;
      case "brand_awareness":
        return <Target className="w-5 h-5" />;
      case "lead_generation":
      case "content_marketing":
      case "seo_boost":
        return <TrendingUp className="w-5 h-5" />;
      default:
        return <Sparkles className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "product_launch":
        return "bg-purple-900/30 text-purple-400 border-purple-800";
      case "holiday_campaign":
        return "bg-red-900/30 text-red-400 border-red-800";
      case "brand_awareness":
        return "bg-blue-900/30 text-blue-400 border-blue-800";
      case "lead_generation":
        return "bg-green-900/30 text-green-400 border-green-800";
      case "content_marketing":
        return "bg-yellow-900/30 text-yellow-400 border-yellow-800";
      case "seo_boost":
        return "bg-orange-900/30 text-orange-400 border-orange-800";
      default:
        return "bg-gray-800 text-gray-400 border-gray-700";
    }
  };

  const handleUseTemplate = (template: CampaignTemplate) => {
    // Navigate to create campaign page with template pre-filled
    router.push(`/dashboard/campaigns/new?template=${template._id}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading templates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: "Templates" },
          ]}
        />

        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-400 hover:text-white mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-display text-white">Campaign Templates</h1>
          <p className="text-gray-400 mt-2">
            Choose a template to quickly set up your marketing campaign
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-800 pb-4">
          {templateTypes.map((type) => (
            <button
              key={type.value}
              onClick={() => setSelectedType(type.value)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                selectedType === type.value
                  ? "bg-primary text-white"
                  : "text-gray-400 hover:text-white hover:bg-gray-800"
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>

        {/* Templates Grid */}
        {templates.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No templates found</h3>
            <p className="text-gray-400">
              {selectedType === "all"
                ? "No campaign templates are available at the moment."
                : `No templates found for this category. Try selecting a different category.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template: CampaignTemplate) => (
              <div
                key={template._id}
                className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors flex flex-col"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${getTypeColor(template.type)}`}>
                      {getTypeIcon(template.type)}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{template.name}</h3>
                      <span
                        className={`px-2 py-1 text-xs rounded capitalize border ${getTypeColor(
                          template.type
                        )}`}
                      >
                        {template.type.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-gray-400 text-sm mb-4 flex-1">{template.description}</p>

                <div className="space-y-2 mb-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Duration:</span>
                    <span className="text-white">{template.default_duration_days} days</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Frequency:</span>
                    <span className="text-white capitalize">{template.default_frequency}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Posts:</span>
                    <span className="text-white">{template.default_posts_count}</span>
                  </div>
                  {template.suggested_topics && template.suggested_topics.length > 0 && (
                    <div className="mt-3">
                      <p className="text-gray-400 text-xs mb-2">Suggested Topics:</p>
                      <div className="flex flex-wrap gap-1">
                        {template.suggested_topics.slice(0, 3).map((topic, idx) => (
                          <span
                            key={idx}
                            className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300"
                          >
                            {topic}
                          </span>
                        ))}
                        {template.suggested_topics.length > 3 && (
                          <span className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-300">
                            +{template.suggested_topics.length - 3} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <Button
                  className="w-full bg-primary hover:bg-primary/90 text-white"
                  onClick={() => handleUseTemplate(template)}
                >
                  Use Template
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreateCampaignRequest } from "@/lib/api/services/campaign.service";
import { useCreateCampaign } from "@/lib/hooks/use-campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ArrowLeft } from "lucide-react";

export default function NewCampaignPage() {
  const router = useRouter();
  const createCampaign = useCreateCampaign();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    goal: "",
    target_audience: "",
    start_date: "",
    end_date: "",
    posting_frequency: "weekly" as "daily" | "weekly" | "biweekly" | "monthly" | "custom",
    custom_schedule: "",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    total_posts_planned: undefined as number | undefined,
    budget: undefined as number | undefined,
    success_metrics: {
      target_views: undefined as number | undefined,
      target_engagement: undefined as number | undefined,
      target_conversions: undefined as number | undefined,
      kpis: [] as string[],
    },
  });

  const [error, setError] = useState("");
  const [isCustomFrequency, setIsCustomFrequency] = useState(false);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!formData.name.trim()) {
      setError("Campaign name is required");
      return;
    }

    if (!formData.goal.trim()) {
      setError("Campaign goal is required");
      return;
    }

    if (!formData.start_date) {
      setError("Start date is required");
      return;
    }

    if (!formData.end_date) {
      setError("End date is required");
      return;
    }

    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    const now = new Date();

    if (startDate >= endDate) {
      setError("End date must be after start date");
      return;
    }

    if (startDate < now) {
      setError("Start date cannot be in the past");
      return;
    }

    if (formData.posting_frequency === "custom" && !formData.custom_schedule?.trim()) {
      setError("Custom schedule is required when frequency is set to custom");
      return;
    }

    // Prepare data
    const campaignData: CreateCampaignRequest = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      goal: formData.goal.trim(),
      target_audience: formData.target_audience?.trim() || undefined,
      start_date: new Date(formData.start_date).toISOString(),
      end_date: new Date(formData.end_date).toISOString(),
      posting_frequency: formData.posting_frequency,
      custom_schedule: formData.posting_frequency === "custom" ? formData.custom_schedule : undefined,
      timezone: formData.timezone,
      total_posts_planned: formData.total_posts_planned || undefined,
      budget: formData.budget || undefined,
      success_metrics: {
        target_views: formData.success_metrics?.target_views || undefined,
        target_engagement: formData.success_metrics?.target_engagement || undefined,
        target_conversions: formData.success_metrics?.target_conversions || undefined,
        kpis: formData.success_metrics?.kpis?.filter((kpi) => kpi.trim()) || undefined,
      },
    };

    createCampaign.mutate(campaignData, {
      onSuccess: () => {
        router.push("/dashboard/campaigns");
      },
      onError: (err: any) => {
        const message = err?.response?.data?.message || "Failed to create campaign";
        setError(message);
      },
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    if (name === "posting_frequency") {
      setIsCustomFrequency(value === "custom");
      setFormData({
        ...formData,
        [name]: value as any,
        custom_schedule: value === "custom" ? formData.custom_schedule : "",
      });
    } else if (name.startsWith("success_metrics.")) {
      const metricKey = name.split(".")[1];
      setFormData({
        ...formData,
        success_metrics: {
          ...formData.success_metrics,
          [metricKey]: value ? Number(value) : undefined,
        },
      });
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  // Get minimum date (today)
  const today = new Date().toISOString().split("T")[0];
  const minEndDate = formData.start_date || today;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: "Create Campaign" },
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
          <h1 className="text-3xl font-display text-white">Create New Campaign</h1>
          <p className="text-gray-400 mt-2">Set up a marketing campaign to schedule and manage your blog posts</p>
        </div>

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Basic Information
              </h3>

              <div>
                <Label htmlFor="name" className="text-gray-300">
                  Campaign Name <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="name"
                  name="name"
                  type="text"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g., Product Launch Campaign"
                  className="mt-1 bg-black border-gray-700 text-white"
                  required
                  maxLength={200}
                />
              </div>

              <div>
                <Label htmlFor="description" className="text-gray-300">
                  Description
                </Label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  placeholder="Describe your campaign goals and strategy..."
                  className="mt-1 flex min-h-[100px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  maxLength={1000}
                />
              </div>

              <div>
                <Label htmlFor="goal" className="text-gray-300">
                  Campaign Goal <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="goal"
                  name="goal"
                  type="text"
                  value={formData.goal}
                  onChange={handleChange}
                  placeholder="e.g., Increase signups by 50%"
                  className="mt-1 bg-black border-gray-700 text-white"
                  required
                  maxLength={500}
                />
              </div>

              <div>
                <Label htmlFor="target_audience" className="text-gray-300">
                  Target Audience
                </Label>
                <Input
                  id="target_audience"
                  name="target_audience"
                  type="text"
                  value={formData.target_audience}
                  onChange={handleChange}
                  placeholder="e.g., Tech-savvy professionals aged 25-40"
                  className="mt-1 bg-black border-gray-700 text-white"
                  maxLength={500}
                />
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Schedule
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="start_date" className="text-gray-300">
                    Start Date <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="start_date"
                    name="start_date"
                    type="datetime-local"
                    value={formData.start_date}
                    onChange={handleChange}
                    min={today}
                    className="mt-1 bg-black border-gray-700 text-white"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="end_date" className="text-gray-300">
                    End Date <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="end_date"
                    name="end_date"
                    type="datetime-local"
                    value={formData.end_date}
                    onChange={handleChange}
                    min={minEndDate}
                    className="mt-1 bg-black border-gray-700 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="posting_frequency" className="text-gray-300">
                  Posting Frequency <span className="text-red-400">*</span>
                </Label>
                <select
                  id="posting_frequency"
                  name="posting_frequency"
                  value={formData.posting_frequency}
                  onChange={handleChange}
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                  required
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              {isCustomFrequency && (
                <div>
                  <Label htmlFor="custom_schedule" className="text-gray-300">
                    Custom Schedule (Cron Expression) <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="custom_schedule"
                    name="custom_schedule"
                    type="text"
                    value={formData.custom_schedule}
                    onChange={handleChange}
                    placeholder="e.g., 0 9 * * 1 (Every Monday at 9 AM)"
                    className="mt-1 bg-black border-gray-700 text-white"
                    required={isCustomFrequency}
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Enter a cron expression for custom scheduling
                  </p>
                </div>
              )}

              <div>
                <Label htmlFor="timezone" className="text-gray-300">
                  Timezone
                </Label>
                <Input
                  id="timezone"
                  name="timezone"
                  type="text"
                  value={formData.timezone}
                  onChange={handleChange}
                  placeholder="UTC"
                  className="mt-1 bg-black border-gray-700 text-white"
                />
                <p className="mt-1 text-xs text-gray-400">
                  Defaults to your browser timezone
                </p>
              </div>
            </div>

            {/* Planning */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Planning
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="total_posts_planned" className="text-gray-300">
                    Total Posts Planned
                  </Label>
                  <Input
                    id="total_posts_planned"
                    name="total_posts_planned"
                    type="number"
                    value={formData.total_posts_planned || ""}
                    onChange={handleChange}
                    min="1"
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="budget" className="text-gray-300">
                    Budget (Optional)
                  </Label>
                  <Input
                    id="budget"
                    name="budget"
                    type="number"
                    value={formData.budget || ""}
                    onChange={handleChange}
                    min="0"
                    step="0.01"
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Success Metrics */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">
                Success Metrics (Optional)
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="target_views" className="text-gray-300">
                    Target Views
                  </Label>
                  <Input
                    id="target_views"
                    name="success_metrics.target_views"
                    type="number"
                    value={formData.success_metrics?.target_views || ""}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="target_engagement" className="text-gray-300">
                    Target Engagement
                  </Label>
                  <Input
                    id="target_engagement"
                    name="success_metrics.target_engagement"
                    type="number"
                    value={formData.success_metrics?.target_engagement || ""}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                </div>

                <div>
                  <Label htmlFor="target_conversions" className="text-gray-300">
                    Target Conversions
                  </Label>
                  <Input
                    id="target_conversions"
                    name="success_metrics.target_conversions"
                    type="number"
                    value={formData.success_metrics?.target_conversions || ""}
                    onChange={handleChange}
                    min="0"
                    className="mt-1 bg-black border-gray-700 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4 border-t border-gray-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white"
                disabled={createCampaign.isPending}
              >
                {createCampaign.isPending ? "Creating..." : "Create Campaign"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

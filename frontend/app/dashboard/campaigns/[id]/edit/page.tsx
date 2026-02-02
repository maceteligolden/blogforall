"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { UpdateCampaignRequest } from "@/lib/api/services/campaign.service";
import { useCampaign, useUpdateCampaign } from "@/lib/hooks/use-campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ArrowLeft } from "lucide-react";

export default function EditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const updateCampaign = useUpdateCampaign();

  const { data: campaignResponse, isLoading } = useCampaign(campaignId);
  const campaign = campaignResponse?.data?.data;

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    goal: string;
    target_audience: string;
    start_date: string;
    end_date: string;
    posting_frequency: "daily" | "weekly" | "biweekly" | "monthly" | "custom";
    custom_schedule: string;
    timezone: string;
    total_posts_planned?: number;
    budget?: number;
  }>({
    name: "",
    description: "",
    goal: "",
    target_audience: "",
    start_date: "",
    end_date: "",
    posting_frequency: "weekly",
    custom_schedule: "",
    timezone: "",
    total_posts_planned: undefined,
    budget: undefined,
  });

  const [error, setError] = useState("");
  const [isCustomFrequency, setIsCustomFrequency] = useState(false);

  useEffect(() => {
    if (campaign) {
      const startDate = new Date(campaign.start_date).toISOString().slice(0, 16);
      const endDate = new Date(campaign.end_date).toISOString().slice(0, 16);
      
      setFormData({
        name: campaign.name,
        description: campaign.description || "",
        goal: campaign.goal,
        target_audience: campaign.target_audience || "",
        start_date: startDate,
        end_date: endDate,
        posting_frequency: campaign.posting_frequency,
        custom_schedule: campaign.custom_schedule || "",
        timezone: campaign.timezone,
        total_posts_planned: campaign.total_posts_planned,
        budget: campaign.budget,
      });
      setIsCustomFrequency(campaign.posting_frequency === "custom");
    }
  }, [campaign]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name?.trim()) {
      setError("Campaign name is required");
      return;
    }

    if (!formData.goal?.trim()) {
      setError("Campaign goal is required");
      return;
    }

    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);

      if (startDate >= endDate) {
        setError("End date must be after start date");
        return;
      }
    }

    if (formData.posting_frequency === "custom" && !formData.custom_schedule?.trim()) {
      setError("Custom schedule is required when frequency is set to custom");
      return;
    }

    const updateData: UpdateCampaignRequest = {
      name: formData.name.trim(),
      description: formData.description?.trim() || undefined,
      goal: formData.goal.trim(),
      target_audience: formData.target_audience?.trim() || undefined,
      start_date: formData.start_date ? new Date(formData.start_date) : undefined,
      end_date: formData.end_date ? new Date(formData.end_date) : undefined,
      posting_frequency: formData.posting_frequency,
      custom_schedule: formData.posting_frequency === "custom" ? formData.custom_schedule : undefined,
      timezone: formData.timezone,
      total_posts_planned: formData.total_posts_planned || undefined,
      budget: formData.budget || undefined,
    };

    updateCampaign.mutate(
      { id: campaignId, data: updateData },
      {
        onSuccess: () => {
          router.push(`/dashboard/campaigns/${campaignId}`);
        },
        onError: (err: any) => {
          const message = err?.response?.data?.message || "Failed to update campaign";
          setError(message);
        },
      }
    );
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
    } else {
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading campaign...</p>
        </div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-white mb-2">Campaign not found</h2>
          <Button onClick={() => router.push("/dashboard/campaigns")} className="bg-primary hover:bg-primary/90 text-white">
            Back to Campaigns
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().slice(0, 16);
  const minEndDate = formData.start_date || today;

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Campaigns", href: "/dashboard/campaigns" },
            { label: campaign.name, href: `/dashboard/campaigns/${campaignId}` },
            { label: "Edit" },
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
          <h1 className="text-3xl font-display text-white">Edit Campaign</h1>
          <p className="text-gray-400 mt-2">Update campaign details</p>
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
                    className="mt-1 bg-black border-gray-700 text-white"
                    required={isCustomFrequency}
                  />
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
                  className="mt-1 bg-black border-gray-700 text-white"
                />
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
                    Budget
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
                disabled={updateCampaign.isPending}
              >
                {updateCampaign.isPending ? "Updating..." : "Update Campaign"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CreateCampaignRequest, CampaignService, CampaignTemplate } from "@/lib/api/services/campaign.service";
import { StrategicService, isContentStrategyReady } from "@/lib/api/services/strategic.service";
import { useCreateCampaign } from "@/lib/hooks/use-campaign";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { QUERY_KEYS } from "@/lib/api/config";
import { ArrowLeft, Sparkles } from "lucide-react";
import { addDays } from "date-fns";
import { useAuthStore } from "@/lib/store/auth.store";
import Link from "next/link";

function NewCampaignPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const templateId = searchParams.get("template");
  const createCampaign = useCreateCampaign();
  const currentSiteId = useAuthStore((s) => s.currentSiteId);

  const { data: contentStrategy } = useQuery({
    queryKey: currentSiteId ? QUERY_KEYS.STRATEGIC_STRATEGY(currentSiteId) : [],
    queryFn: () => StrategicService.getStrategy(currentSiteId as string),
    enabled: !!currentSiteId,
  });
  const strategyReady = isContentStrategyReady(contentStrategy);

  const { data: template } = useQuery({
    queryKey: ["campaign-template", templateId],
    queryFn: async () => {
      if (!templateId) return null;
      const response = await CampaignService.getCampaignTemplateById(templateId);
      return response.data?.data;
    },
    enabled: !!templateId,
  });

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    goal: "",
    target_audience: "",
    desired_transformation: "",
    messaging: "",
    funnel_focus: "full_funnel" as "awareness" | "consideration" | "conversion" | "full_funnel",
    primary_cta: "",
    kpi_input: "",
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

  // Pre-fill form with template data if template is provided
  useEffect(() => {
    if (template) {
      const startDate = new Date();
      const endDate = addDays(startDate, template.default_duration_days);

      setFormData({
        name: "",
        description: "",
        goal: template.default_goal,
        target_audience: "",
        desired_transformation: "",
        messaging: "",
        funnel_focus: "full_funnel" as const,
        primary_cta: "",
        kpi_input: "",
        start_date: startDate.toISOString().slice(0, 16),
        end_date: endDate.toISOString().slice(0, 16),
        posting_frequency: template.default_frequency as "daily" | "weekly" | "biweekly" | "monthly" | "custom",
        custom_schedule: "",
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
        total_posts_planned: template.default_posts_count,
        budget: undefined,
        success_metrics: {
          target_views: undefined,
          target_engagement: undefined,
          target_conversions: undefined,
          kpis: [],
        },
      });
      setIsCustomFrequency(template.default_frequency === "custom");
    }
  }, [template]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!strategyReady) {
      setError("Content Strategy must be ready before you can create a campaign.");
      return;
    }

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
      desired_transformation: formData.desired_transformation?.trim() || undefined,
      messaging: formData.messaging?.trim() || undefined,
      funnel_focus: formData.funnel_focus,
      cta_strategy: formData.primary_cta.trim() ? { primary_cta: formData.primary_cta.trim() } : undefined,
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
        kpis: [
          ...(formData.success_metrics?.kpis?.filter((kpi) => kpi.trim()) || []),
          ...formData.kpi_input
            .split(",")
            .map((kpi) => kpi.trim())
            .filter(Boolean),
        ],
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
    } else if (name === "total_posts_planned" || name === "budget") {
      setFormData({
        ...formData,
        [name]: value ? Number(value) : undefined,
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
        <Breadcrumb items={[{ label: "Campaigns", href: "/dashboard/campaigns" }, { label: "Create Campaign" }]} />

        <div className="mb-6">
          <Button variant="ghost" onClick={() => router.back()} className="text-gray-400 hover:text-white mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <h1 className="text-3xl font-display text-white">Create campaign</h1>
          <p className="text-gray-400 mt-2">
            Advanced fallback. Named campaigns usually start in chat. This form is for when you already know the parameters.
          </p>
        </div>

        {!strategyReady && (
          <div className="mb-6 rounded-lg border border-amber-800 bg-amber-900/20 px-4 py-3 text-sm text-amber-100">
            Content Strategy must be ready before you create a campaign.{" "}
            <Link href="/dashboard/strategy" className="text-primary hover:underline">
              Open Content Strategy
            </Link>
            {contentStrategy?.generation_status === "generating" ? " — generation is still running." : "."}
          </div>
        )}

        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">{error}</div>
            )}

            {contentStrategy && strategyReady && (
              <div className="rounded-md border border-gray-800 bg-black/30 p-4 text-sm text-gray-300 space-y-1">
                <p className="text-xs uppercase tracking-wide text-gray-500">Executing Content Strategy</p>
                <p>{contentStrategy.document.north_star.what_we_are || contentStrategy.purpose}</p>
                {contentStrategy.document.audience.primary.who ? (
                  <p className="text-gray-400">Audience: {contentStrategy.document.audience.primary.who}</p>
                ) : null}
                {contentStrategy.document.conversion.primary_cta ? (
                  <p className="text-gray-400">Primary CTA: {contentStrategy.document.conversion.primary_cta}</p>
                ) : null}
              </div>
            )}

            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Basic Information</h3>

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
                <Label htmlFor="desired_transformation" className="text-gray-300">
                  Intent / desired outcome
                </Label>
                <textarea
                  id="desired_transformation"
                  name="desired_transformation"
                  value={formData.desired_transformation}
                  onChange={handleChange}
                  placeholder="What should be true after this campaign? e.g. operators trust us enough to start a trial."
                  className="mt-1 flex min-h-[80px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  maxLength={2000}
                />
                <p className="mt-1 text-xs text-gray-500">We use this as the campaign intent for planning and drafts.</p>
              </div>

              <div>
                <Label htmlFor="target_audience" className="text-gray-300">
                  Target Audience
                </Label>
                <textarea
                  id="target_audience"
                  name="target_audience"
                  value={formData.target_audience}
                  onChange={handleChange}
                  placeholder="Who they are, the situation they are in, and what they need to believe. e.g. Founders at 10–50 person SaaS teams who already tried generic AI writers and still have no publishing cadence."
                  className="mt-1 flex min-h-[90px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  maxLength={2000}
                />
              </div>

              <div>
                <Label htmlFor="messaging" className="text-gray-300">
                  Messaging
                </Label>
                <textarea
                  id="messaging"
                  name="messaging"
                  value={formData.messaging}
                  onChange={handleChange}
                  placeholder="The story and promises this campaign should repeat."
                  className="mt-1 flex min-h-[70px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  maxLength={2000}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="funnel_focus" className="text-gray-300">
                    Funnel focus
                  </Label>
                  <select
                    id="funnel_focus"
                    name="funnel_focus"
                    value={formData.funnel_focus}
                    onChange={handleChange}
                    className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black px-3 py-2 text-sm text-white"
                  >
                    <option value="full_funnel">Full funnel</option>
                    <option value="awareness">Awareness</option>
                    <option value="consideration">Consideration</option>
                    <option value="conversion">Conversion</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="primary_cta" className="text-gray-300">
                    Primary CTA
                  </Label>
                  <Input
                    id="primary_cta"
                    name="primary_cta"
                    type="text"
                    value={formData.primary_cta}
                    onChange={handleChange}
                    placeholder="e.g. Start a free trial"
                    className="mt-1 bg-black border-gray-700 text-white"
                    maxLength={300}
                  />
                </div>
              </div>
            </div>

            {/* Schedule */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Schedule</h3>

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
                  <p className="mt-1 text-xs text-gray-400">Enter a cron expression for custom scheduling</p>
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
                <p className="mt-1 text-xs text-gray-400">Defaults to your browser timezone</p>
              </div>
            </div>

            {/* Planning */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white border-b border-gray-800 pb-2">Planning</h3>

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

              <div>
                <Label htmlFor="kpi_input" className="text-gray-300">
                  KPIs
                </Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    id="kpi_input"
                    name="kpi_input"
                    type="text"
                    value={formData.kpi_input}
                    onChange={handleChange}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        const next = formData.kpi_input
                          .split(",")
                          .map((kpi) => kpi.trim())
                          .filter(Boolean);
                        if (!next.length) return;
                        setFormData({
                          ...formData,
                          kpi_input: "",
                          success_metrics: {
                            ...formData.success_metrics,
                            kpis: [...new Set([...(formData.success_metrics.kpis || []), ...next])],
                          },
                        });
                      }
                    }}
                    placeholder="Type a KPI and press Enter, or comma-separate several"
                    className="bg-black border-gray-700 text-white"
                  />
                </div>
                {(formData.success_metrics.kpis?.length ?? 0) > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.success_metrics.kpis.map((kpi) => (
                      <button
                        key={kpi}
                        type="button"
                        className="text-xs px-2 py-1 rounded border border-gray-700 text-gray-300 hover:border-gray-500"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            success_metrics: {
                              ...formData.success_metrics,
                              kpis: formData.success_metrics.kpis.filter((item) => item !== kpi),
                            },
                          })
                        }
                      >
                        {kpi} ×
                      </button>
                    ))}
                  </div>
                )}
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
                disabled={createCampaign.isPending || !strategyReady}
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

export default function NewCampaignPage() {
  return (
    <Suspense
      fallback={<div className="min-h-screen bg-black flex items-center justify-center text-gray-400">Loading...</div>}
    >
      <NewCampaignPageContent />
    </Suspense>
  );
}

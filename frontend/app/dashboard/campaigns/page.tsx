"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CampaignService, Campaign } from "@/lib/api/services/campaign.service";
import { Button } from "@/components/ui/button";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { QUERY_KEYS } from "@/lib/api/config";
import { Calendar, Plus, Play, Pause, X } from "lucide-react";

export default function CampaignsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: campaignsResponse, isLoading } = useQuery({
    queryKey: QUERY_KEYS.MY_CAMPAIGNS,
    queryFn: () => CampaignService.getCampaigns(),
  });

  const campaigns: Campaign[] = campaignsResponse?.data?.data || [];

  const filteredCampaigns = campaigns.filter((campaign) => {
    if (statusFilter === "all") return true;
    return campaign.status === statusFilter;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading campaigns...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Campaigns" }]} />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display text-white">My Campaigns</h1>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => router.push("/dashboard/campaigns/new")}
          >
            <Plus className="w-4 h-4 mr-2" />
            Create Campaign
          </Button>
        </div>

        {/* Status Filter */}
        <div className="mb-6">
          <div className="flex items-center space-x-2 border border-gray-800 rounded-lg p-1 bg-gray-900">
            {["all", "draft", "active", "paused", "completed", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
                  statusFilter === status
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Campaigns List */}
        {filteredCampaigns.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">No campaigns yet</h3>
            <p className="text-gray-400 mb-6">Create your first campaign to schedule blog posts</p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => router.push("/dashboard/campaigns/new")}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredCampaigns.map((campaign) => (
              <div
                key={campaign._id}
                className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors cursor-pointer"
                onClick={() => router.push(`/dashboard/campaigns/${campaign._id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white line-clamp-2 flex-1">
                    {campaign.name}
                  </h3>
                  <span
                    className={`ml-2 px-2 py-1 text-xs rounded capitalize whitespace-nowrap ${
                      campaign.status === "active"
                        ? "bg-green-900/30 text-green-400 border border-green-800"
                        : campaign.status === "draft"
                          ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800"
                          : campaign.status === "paused"
                            ? "bg-blue-900/30 text-blue-400 border border-blue-800"
                            : campaign.status === "completed"
                              ? "bg-gray-800 text-gray-400 border border-gray-700"
                              : "bg-red-900/30 text-red-400 border border-red-800"
                    }`}
                  >
                    {campaign.status}
                  </span>
                </div>

                {campaign.description && (
                  <p className="text-sm text-gray-400 line-clamp-2 mb-4">{campaign.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Goal:</span>
                    <span className="text-gray-300">{campaign.goal}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Posts Published:</span>
                    <span className="text-gray-300">{campaign.posts_published}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Frequency:</span>
                    <span className="text-gray-300 capitalize">{campaign.posting_frequency}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Start Date:</span>
                    <span className="text-gray-300">
                      {new Date(campaign.start_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">End Date:</span>
                    <span className="text-gray-300">
                      {new Date(campaign.end_date).toLocaleDateString()}
                    </span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-4 border-t border-gray-800">
                  {campaign.status === "draft" && (
                    <Button
                      size="sm"
                      className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement activate
                      }}
                    >
                      <Play className="w-3 h-3 mr-1" />
                      Activate
                    </Button>
                  )}
                  {campaign.status === "active" && (
                    <Button
                      size="sm"
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement pause
                      }}
                    >
                      <Pause className="w-3 h-3 mr-1" />
                      Pause
                    </Button>
                  )}
                  {(campaign.status === "active" || campaign.status === "paused") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 border-red-600 text-red-400 hover:bg-red-900/20"
                      onClick={(e) => {
                        e.stopPropagation();
                        // TODO: Implement cancel
                      }}
                    >
                      <X className="w-3 h-3 mr-1" />
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

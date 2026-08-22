"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useCampaigns } from "@/lib/hooks/use-campaign";
import { CampaignService, type Campaign } from "@/lib/api/services/campaign.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { pickMostUrgentUndrafted } from "@/lib/writing/sort-roadmap-topics";
import { buildWritePostThreadRequest } from "@/lib/writing/write-post-request";
import { useStartWritingThread } from "@/lib/writing/use-start-writing-thread";
import { CampaignSelectList, campaignRecordId } from "@/components/campaign/campaign-select-list";
import { TopicSelectCarousel } from "@/components/campaign/topic-select-carousel";
import {
  CampaignTopicStepPills,
  type CampaignTopicStep,
} from "@/components/campaign/campaign-topic-step-pills";
import type { RoadmapPayload } from "@/lib/writing/roadmap-topic";

export function WritePostModal({
  isOpen,
  onClose,
  stayOnPage,
}: {
  isOpen: boolean;
  onClose: () => void;
  stayOnPage?: boolean;
}) {
  const { startWritingThread } = useStartWritingThread();
  const { data: campaignsResponse, isLoading: campaignsLoading } = useCampaigns();
  const campaigns: Campaign[] = useMemo(() => campaignsResponse?.data?.data || [], [campaignsResponse]);
  const [step, setStep] = useState<CampaignTopicStep>("campaign");
  const [campaignId, setCampaignId] = useState("");
  const [topicIndex, setTopicIndex] = useState<number | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setStep("campaign");
      setCampaignId("");
      setTopicIndex(null);
      setStarting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || campaignId || !campaigns.length) return;
    const preferred = campaigns.find((c) => c.is_default) ?? campaigns[0];
    setCampaignId(campaignRecordId(preferred));
  }, [isOpen, campaigns, campaignId]);

  const selectedCampaign = campaigns.find((c) => campaignRecordId(c) === campaignId);
  const { data: roadmap, isLoading: roadmapLoading } = useQuery({
    queryKey: QUERY_KEYS.CAMPAIGN_ROADMAP(campaignId),
    queryFn: async () => {
      const res = await CampaignService.getRoadmap(campaignId);
      return res.data.data as RoadmapPayload;
    },
    enabled: isOpen && Boolean(campaignId),
  });

  const items = roadmap?.current?.items ?? [];
  const urgent = useMemo(() => pickMostUrgentUndrafted(items), [items]);

  useEffect(() => {
    if (step !== "topic" || topicIndex != null || !urgent) return;
    setTopicIndex(urgent.sequence_index);
  }, [step, topicIndex, urgent]);

  const selectedTopic = items.find((item) => item.sequence_index === topicIndex);

  const goTopics = () => {
    if (!campaignId) return;
    setTopicIndex(null);
    setStep("topic");
  };

  const confirm = async () => {
    if (!selectedCampaign || !selectedTopic) return;
    setStarting(true);
    try {
      await startWritingThread(
        buildWritePostThreadRequest({
          campaignId: campaignRecordId(selectedCampaign),
          campaignName: selectedCampaign.name,
          sequenceIndex: selectedTopic.sequence_index,
          topic: selectedTopic.title,
          intent: selectedTopic.strategic_intent,
          blogId: selectedTopic.blog_id,
          stayOnPage,
        })
      );
      onClose();
    } finally {
      setStarting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Write a post"
      size="xl"
      footer={
        <div className="flex justify-between gap-3">
          {step === "topic" ? (
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={() => setStep("campaign")}
              disabled={starting}
            >
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={onClose}
              disabled={starting}
            >
              Cancel
            </Button>
            {step === "campaign" ? (
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={goTopics}
                disabled={!campaignId}
              >
                Continue
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-primary hover:bg-primary/90 text-white"
                onClick={() => void confirm()}
                disabled={!selectedTopic || starting}
              >
                {starting ? "Starting…" : "Start writing"}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <CampaignTopicStepPills step={step} label="Write post steps" />

      {step === "campaign" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">Choose the campaign this post should serve.</p>
          <CampaignSelectList
            campaigns={campaigns}
            selectedId={campaignId}
            onSelect={setCampaignId}
            loading={campaignsLoading}
          />
        </div>
      )}

      {step === "topic" && (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Pick a topic from {selectedCampaign?.name || "this campaign"}. The most urgent undrafted item is selected.
          </p>
          <TopicSelectCarousel
            items={items}
            selectedIndex={topicIndex}
            urgentIndex={urgent?.sequence_index}
            onSelect={setTopicIndex}
            loading={roadmapLoading}
          />
        </div>
      )}
    </Modal>
  );
}

export type RoadmapTopic = {
  title: string;
  objective: string;
  strategic_intent: string;
  scheduled_at?: string;
  sequence_index: number;
  about?: string;
  blog_id?: string;
  draft_status?: string;
};

export type RoadmapPayload = {
  current?: {
    status: string;
    items: RoadmapTopic[];
  };
};

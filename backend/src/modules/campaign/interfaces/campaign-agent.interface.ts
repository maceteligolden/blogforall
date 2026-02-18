import { PostFrequency } from "../../../shared/constants/campaign.constant";

/** One message in the agent conversation. */
export interface AgentChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

/** Campaign part of an agent proposal (matches CreateCampaignInput shape). */
export interface AgentProposalCampaign {
  name: string;
  description?: string;
  goal: string;
  target_audience?: string;
  start_date: string; // ISO date
  end_date: string;
  posting_frequency: PostFrequency;
  timezone?: string;
  total_posts_planned?: number;
}

/** One scheduled post in an agent proposal. */
export interface AgentProposalScheduledPost {
  title: string;
  scheduled_at: string; // ISO date
  timezone?: string;
  generation_prompt: string;
  content_theme?: string;
}

/** Full proposal: campaign + scheduled posts (parsed from agent JSON). */
export interface AgentProposal {
  campaign: AgentProposalCampaign;
  scheduled_posts: AgentProposalScheduledPost[];
}

/** Response from the agent chat endpoint. */
export interface AgentChatResponse {
  reply: string;
  session_id: string;
  proposal?: AgentProposal;
}

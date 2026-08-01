/**
 * Optional strategic context enrichment for load_context (doc 21).
 * Implemented by StrategicContextService to avoid circular imports in the graph node.
 */
export type StrategicContextResult = {
  campaign_id?: string;
  strategy_id?: string;
  prompt_suffix?: string;
  metadata: Record<string, unknown>;
};

export type StrategicContextLoader = {
  load(workspaceId: string, userId: string, campaignId?: string): Promise<StrategicContextResult>;
};

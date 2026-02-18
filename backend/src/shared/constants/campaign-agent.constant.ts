/**
 * Campaign Agent Configuration
 * Chat-based AI campaign manager using Hugging Face (same token as blog review).
 */

export const CampaignAgentConfig = {
  /** Reuse HF token from blog review / HF_TOKEN */
  HUGGINGFACE_API_TOKEN: (
    process.env.HUGGINGFACE_API_TOKEN ||
    process.env.HF_TOKEN ||
    ""
  ).trim(),

  /** Chat model for the campaign agent (hf-inference compatible). */
  AGENT_MODEL: process.env.CAMPAIGN_AGENT_MODEL || "HuggingFaceTB/SmolLM3-3B",

  /** Max conversation turns to send to the model (each turn = user + assistant). */
  MAX_HISTORY_TURNS: parseInt(process.env.CAMPAIGN_AGENT_MAX_HISTORY_TURNS || "20", 10),

  /** Max tokens per assistant reply. */
  MAX_TOKENS: parseInt(process.env.CAMPAIGN_AGENT_MAX_TOKENS || "1500", 10),

  /** Temperature for chat (0 = focused, 1 = more varied). */
  TEMPERATURE: parseFloat(process.env.CAMPAIGN_AGENT_TEMPERATURE || "0.5"),

  /** Session TTL in ms (in-memory sessions). 2 hours default. */
  SESSION_TTL_MS: parseInt(process.env.CAMPAIGN_AGENT_SESSION_TTL_MS || "7200000", 10),
};

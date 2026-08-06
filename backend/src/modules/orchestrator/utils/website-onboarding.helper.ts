import type { WorkspaceOnboardingProposal } from "../../../shared/schemas/workspace-memory.schema";
import { normalizeCompetitors, normalizeCustomers } from "../../../shared/types/business-profile";

export const WEBSITE_ONBOARDING_QUESTION =
  "Do you have a website for your person or business? Paste the URL, or say you don't have one.";

export const WEBSITE_PROPOSAL_CONFIRM_QUESTION =
  "Does this look right? Reply yes to apply it, or no to set things up via chat instead.";

const URL_RE = /https?:\/\/[^\s<>"')\]]+/i;
const BARE_DOMAIN_RE = /(?:^|\s)((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,})(?:\/[^\s]*)?/i;

const NO_WEBSITE_RE =
  /\b(no\s+(website|site|url)|don'?t\s+have\s+(one|a\s+website|a\s+site)|no\s+i\s+don'?t|none|skip|n\/a)\b/i;

const AFFIRM_RE =
  /^(yes|y|yeah|yep|correct|looks\s+good|confirm|apply|approve|ok|okay|sure|do\s+it|go\s+ahead)[.!]?\s*$/i;
const REJECT_RE = /^(no|n|nope|nah|wrong|reject|start\s+over|chat\s+instead|not\s+right|incorrect)[.!]?\s*$/i;

const CONTEXT_REFRESH_INTENT_RE =
  /\b(update|refresh|revise|change|edit|redo)\b.{0,40}\b(business|brand|workspace|company|context|profile|memory|audience|voice|goals)\b|\b(business|brand)\s+context\b/i;

/** Extract and normalize a website URL from free text, or null. */
export function extractWebsiteUrl(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const withScheme = trimmed.match(URL_RE);
  if (withScheme?.[0]) {
    return normalizeWebsiteUrl(withScheme[0].replace(/[.,;:!?)]+$/, ""));
  }

  const bare = trimmed.match(BARE_DOMAIN_RE);
  if (bare?.[1]) {
    const candidate = bare[0].trim().replace(/[.,;:!?)]+$/, "");
    return normalizeWebsiteUrl(`https://${candidate}`);
  }

  return null;
}

export function normalizeWebsiteUrl(raw: string): string | null {
  try {
    const url = new URL(raw.includes("://") ? raw : `https://${raw}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    url.hash = "";
    return url.toString().replace(/\/$/, "") || url.origin;
  } catch {
    return null;
  }
}

export function isNoWebsiteReply(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (extractWebsiteUrl(t)) return false;
  return NO_WEBSITE_RE.test(t) || /^(no|none|skip|n\/a)[.!]?$/i.test(t);
}

export function isAffirmativeReply(text: string): boolean {
  return AFFIRM_RE.test(text.trim());
}

export function isRejectReply(text: string): boolean {
  return REJECT_RE.test(text.trim());
}

export function isBusinessContextRefreshIntent(text: string): boolean {
  return CONTEXT_REFRESH_INTENT_RE.test(text.trim());
}

export function formatProposalSummary(proposal: WorkspaceOnboardingProposal, websiteUrl?: string): string {
  const lines: string[] = ["Here's what I gathered from your website:"];
  if (websiteUrl) lines.push(`• Website: ${websiteUrl}`);
  const description = proposal.business_description || proposal.business_type;
  if (description) lines.push(`• Business: ${description}`);
  if (proposal.business_model) lines.push(`• Model: ${proposal.business_model.toUpperCase()}`);
  if (proposal.industries?.length) lines.push(`• Industries: ${proposal.industries.join("; ")}`);
  if (proposal.customers?.length) {
    lines.push(
      `• Customers: ${proposal.customers
        .map((c) => c.label || c.who)
        .filter(Boolean)
        .join("; ")}`
    );
  } else if (proposal.target_audience?.length) {
    lines.push(`• Audience: ${proposal.target_audience.join("; ")}`);
  }
  if (proposal.brand_voice) lines.push(`• Brand voice: ${proposal.brand_voice}`);
  if (proposal.brand_negatives) lines.push(`• Avoid: ${proposal.brand_negatives}`);
  if (proposal.business_goals?.length) {
    lines.push(`• Goals: ${proposal.business_goals.join("; ")}`);
  }
  if (proposal.seo_priorities?.length) {
    lines.push(`• SEO priorities: ${proposal.seo_priorities.join("; ")}`);
  }
  if (proposal.publishing_channels?.length) {
    lines.push(`• Channels: ${proposal.publishing_channels.join("; ")}`);
  }
  if (proposal.competitors?.length) {
    lines.push(`• Competitors: ${proposal.competitors.map((c) => c.name).join("; ")}`);
  } else if (proposal.competitive_notes) {
    lines.push(`• Competitors: ${proposal.competitive_notes}`);
  }
  if (proposal.tone) lines.push(`• Tone: ${proposal.tone}`);
  if (proposal.default_word_count != null) {
    lines.push(`• Default post length: ~${proposal.default_word_count} words`);
  }
  lines.push("");
  lines.push(WEBSITE_PROPOSAL_CONFIRM_QUESTION);
  return lines.join("\n");
}

/** Map a confirmed proposal into a WorkspaceMemory patch. */
export function proposalToMemoryPatch(
  proposal: WorkspaceOnboardingProposal,
  websiteUrl?: string
): Record<string, unknown> {
  const strategic: Record<string, unknown> = {};
  if (websiteUrl) strategic.website_url = websiteUrl;
  const description = proposal.business_description || proposal.business_type;
  if (description) strategic.business_description = description;
  if (proposal.business_model) strategic.business_model = proposal.business_model;
  if (proposal.industries?.length) strategic.industries = proposal.industries;
  if (proposal.target_audience?.length) strategic.target_audience = proposal.target_audience;
  const customers = normalizeCustomers(proposal.customers, proposal.target_audience);
  if (customers.length) {
    strategic.customers = customers;
    if (!strategic.target_audience) {
      strategic.target_audience = customers.map((c) => c.label || c.who).filter(Boolean);
    }
  }
  if (proposal.brand_voice) strategic.brand_voice = proposal.brand_voice;
  if (proposal.brand_negatives) strategic.brand_negatives = proposal.brand_negatives;
  if (proposal.business_goals?.length) strategic.business_goals = proposal.business_goals;
  if (proposal.seo_priorities?.length) strategic.seo_priorities = proposal.seo_priorities;
  if (proposal.publishing_channels?.length) strategic.publishing_channels = proposal.publishing_channels;
  const competitors = normalizeCompetitors(proposal.competitors, proposal.competitive_notes);
  if (competitors.length) strategic.competitors = competitors;

  const preferences: Record<string, unknown> = {};
  if (proposal.tone) preferences.tone = proposal.tone;
  if (proposal.default_word_count != null) preferences.default_word_count = proposal.default_word_count;

  const patch: Record<string, unknown> = {};
  if (Object.keys(strategic).length > 0) patch.strategic = strategic;
  if (Object.keys(preferences).length > 0) patch.preferences = preferences;
  if (proposal.memory_summary?.trim()) patch.memory_summary = proposal.memory_summary.trim();
  return patch;
}

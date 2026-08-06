import { PostFrequency } from "../../../shared/constants/campaign.constant";
import type { CreateCampaignInput } from "../../campaign/interfaces/campaign.interface";

export type CampaignDraftSlots = {
  name?: string;
  goal?: string;
  target_audience?: string;
  start_date?: string;
  end_date?: string;
  posting_frequency?: PostFrequency;
  description?: string;
  awaiting_confirm?: boolean;
};

export type CampaignCollectResult =
  | { status: "ask"; question: string; slots: CampaignDraftSlots; field: keyof CampaignDraftSlots }
  | { status: "confirm"; summary: string; slots: CampaignDraftSlots }
  | { status: "create"; payload: CreateCampaignInput; slots: CampaignDraftSlots }
  | { status: "discuss"; reply: string; slots: CampaignDraftSlots };

export type WorkspaceCampaignHints = {
  brand_voice?: string;
  target_audience?: string[];
  business_goals?: string[];
  suggested_theme?: string;
};

const FIELD_ORDER: Array<keyof CampaignDraftSlots> = [
  "name",
  "goal",
  "target_audience",
  "start_date",
  "end_date",
  "posting_frequency",
];

const QUESTIONS: Record<string, string> = {
  name: "What should we call this campaign?",
  goal: "What’s the main goal for this campaign?",
  target_audience: "Who is the target audience?",
  start_date: "When should it start? (e.g. 2026-09-01 or “next Monday”)",
  end_date: "When should it end?",
  posting_frequency: "How often should we post — daily, weekly, biweekly, or monthly?",
};

const CONFIRM_RE = /\b(?:yes|yep|sure|confirm|create\s+it|looks?\s+good|go\s+ahead|do\s+it)\b/i;
const REJECT_RE = /\b(?:no|nope|change|edit|wait|not\s+yet)\b/i;

function parseFrequency(raw: string): PostFrequency | undefined {
  const m = raw.trim().toLowerCase();
  if (/\bdaily\b/.test(m)) return PostFrequency.DAILY;
  if (/\bbi[\s-]?weekly\b/.test(m)) return PostFrequency.BIWEEKLY;
  if (/\bweekly\b/.test(m)) return PostFrequency.WEEKLY;
  if (/\bmonthly\b/.test(m)) return PostFrequency.MONTHLY;
  if (/\bcustom\b/.test(m)) return PostFrequency.CUSTOM;
  return undefined;
}

function parseDateHint(raw: string): string | undefined {
  const iso = raw.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso?.[1]) return iso[1];
  const trimmed = raw.trim();
  if (trimmed.length >= 3 && trimmed.length <= 80) return trimmed;
  return undefined;
}

function nextMissingField(slots: CampaignDraftSlots): keyof CampaignDraftSlots | undefined {
  return FIELD_ORDER.find((f) => {
    const v = slots[f];
    return v === undefined || v === null || (typeof v === "string" && !v.trim());
  });
}

function applyAnswer(field: keyof CampaignDraftSlots, message: string, slots: CampaignDraftSlots): CampaignDraftSlots {
  const next = { ...slots };
  const text = message.trim();
  switch (field) {
    case "name":
      next.name = text.slice(0, 120);
      break;
    case "goal":
      next.goal = text.slice(0, 500);
      break;
    case "target_audience":
      next.target_audience = text.slice(0, 300);
      break;
    case "description":
      next.description = text.slice(0, 1000);
      break;
    case "start_date":
      next.start_date = parseDateHint(text) ?? text.slice(0, 80);
      break;
    case "end_date":
      next.end_date = parseDateHint(text) ?? text.slice(0, 80);
      break;
    case "posting_frequency": {
      const freq = parseFrequency(text);
      if (freq) next.posting_frequency = freq;
      break;
    }
    default:
      break;
  }
  return next;
}

function resolveDate(raw: string, fallbackDaysFromNow: number): Date {
  const iso = raw.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (iso) {
    const d = new Date(`${iso[1]}T12:00:00.000Z`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + fallbackDaysFromNow);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

function toCreatePayload(slots: CampaignDraftSlots): CreateCampaignInput | null {
  if (!slots.name?.trim() || !slots.goal?.trim()) return null;
  const start = resolveDate(slots.start_date ?? "", 1);
  let end = resolveDate(slots.end_date ?? "", 30);
  if (end <= start) {
    end = new Date(start.getTime());
    end.setUTCDate(end.getUTCDate() + 30);
  }
  return {
    name: slots.name.trim(),
    goal: slots.goal.trim(),
    target_audience: slots.target_audience?.trim(),
    description: slots.description?.trim(),
    start_date: start,
    end_date: end,
    posting_frequency: slots.posting_frequency ?? PostFrequency.WEEKLY,
  };
}

function buildConfirmSummary(slots: CampaignDraftSlots): string {
  const freq = slots.posting_frequency ?? PostFrequency.WEEKLY;
  return [
    "Here’s the campaign I’ll create:",
    `• Name: ${slots.name}`,
    `• Goal: ${slots.goal}`,
    slots.target_audience ? `• Audience: ${slots.target_audience}` : null,
    `• Dates: ${slots.start_date ?? "(soon)"} → ${slots.end_date ?? "(+30 days)"}`,
    `• Cadence: ${freq}`,
    "",
    "Create this campaign?",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Deterministic one-field-at-a-time campaign draft collection.
 * Returns the next question, a confirm prompt, or a ready create payload.
 */
function extractNamedCampaign(message: string): string | undefined {
  const named = message.match(
    /\b(?:campaign\s+(?:called|named)|create\s+(?:a\s+)?campaign(?:\s+called|\s+named)?)\s+["']?([^"'.,]+)["']?/i
  );
  return named?.[1]?.trim().slice(0, 80);
}

/** One suggested default for the next missing field — never a full campaign dump. */
function suggestForField(
  field: keyof CampaignDraftSlots,
  slots: CampaignDraftSlots,
  hints?: WorkspaceCampaignHints
): string | undefined {
  const audience = hints?.target_audience?.filter(Boolean)[0];
  const goal = hints?.business_goals?.filter(Boolean)[0];
  const theme = hints?.suggested_theme?.trim() || goal?.split(/[.!?]/)[0]?.trim();
  switch (field) {
    case "name":
      return theme
        ? `${theme.replace(/\s+/g, " ").slice(0, 40)} campaign`.replace(/^\w/, (c) => c.toUpperCase())
        : undefined;
    case "goal":
      return goal
        ? `Advance: ${goal}`.slice(0, 220)
        : slots.name
          ? `Grow awareness and leads for ${slots.name}`.slice(0, 220)
          : undefined;
    case "target_audience":
      return audience?.slice(0, 220);
    case "start_date":
      return "next Monday";
    case "end_date":
      return "in 90 days";
    case "posting_frequency":
      return "weekly";
    default:
      return undefined;
  }
}

function askWithSuggestion(
  field: keyof CampaignDraftSlots,
  slots: CampaignDraftSlots,
  hints?: WorkspaceCampaignHints
): CampaignCollectResult {
  const base = QUESTIONS[field] ?? "Tell me more about the campaign.";
  const suggestion = suggestForField(field, slots, hints);
  const question = suggestion
    ? `${base}\n\nSuggestion from your workspace: “${suggestion}”\nReply with that, tweak it, or write your own.`
    : base;
  return { status: "ask", question, slots, field };
}

export function advanceCampaignCollect(
  message: string,
  prior: CampaignDraftSlots | undefined,
  opts?: { intent?: string; hints?: WorkspaceCampaignHints }
): CampaignCollectResult {
  const slots: CampaignDraftSlots = { ...(prior ?? {}) };
  const intent = opts?.intent ?? "create_campaign";

  // #region agent log
  fetch("http://127.0.0.1:7845/ingest/3b4333d1-9478-4155-a0c2-6acee25e28ec", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "17457c" },
    body: JSON.stringify({
      sessionId: "17457c",
      runId: "post-fix",
      hypothesisId: "H-E",
      location: "campaign-collect.helper.ts:advanceCampaignCollect",
      message: "campaign collect entry",
      data: {
        intent,
        priorKeys: Object.keys(prior ?? {}),
        msg: message.slice(0, 80),
        awaiting: Boolean(slots.awaiting_confirm),
        hasHints: Boolean(opts?.hints),
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (
    intent === "learn_campaign" ||
    intent === "campaign_performance" ||
    intent === "discuss_campaign" ||
    intent === "campaign_content"
  ) {
    const followUp = message.trim();
    const wantsList = /\b(?:list|which|show|all|my)\b/i.test(followUp) || followUp.length < 4;
    return {
      status: "discuss",
      reply:
        intent === "campaign_performance"
          ? "I can check campaign health and progress. Tell me the campaign name, or say “list campaigns” and I’ll pull them up."
          : intent === "campaign_content"
            ? "Which campaign should we plan content for? Share the name, or say “list campaigns”."
            : wantsList
              ? "Campaigns sit under your workspace strategy and drive blog posts. Say “list campaigns” and I’ll show what’s active, or name one to open."
              : `Got it — you want more on “${followUp.slice(0, 80)}”. I can list your campaigns, open one by name, or walk through goals/cadence/strategy fit. Which should we do?`,
      slots,
    };
  }

  if (slots.awaiting_confirm) {
    if (CONFIRM_RE.test(message) && !REJECT_RE.test(message)) {
      const payload = toCreatePayload(slots);
      if (payload) {
        return { status: "create", payload, slots: { ...slots, awaiting_confirm: false } };
      }
    }
    if (REJECT_RE.test(message)) {
      const cleared = { ...slots, awaiting_confirm: false };
      const field = nextMissingField(cleared) ?? "name";
      return {
        status: "ask",
        question: `No problem — let's adjust. ${QUESTIONS[field]}`,
        slots: cleared,
        field,
      };
    }
    return {
      status: "confirm",
      summary: buildConfirmSummary(slots),
      slots: { ...slots, awaiting_confirm: true },
    };
  }

  // Accept "use that" / "sounds good" as accepting the last field suggestion.
  const acceptSuggestion = /\b(?:use\s+that|sounds?\s+good|that\s+works|go\s+with\s+(?:that|it)|suggested)\b/i.test(
    message
  );

  const missingBefore = nextMissingField(slots);
  if (missingBefore && message.trim() && !/^(hi|hello|hey)\b/i.test(message.trim())) {
    // Treat this message as the answer to the outstanding field when we already asked.
    if (prior && Object.keys(prior).length > 0) {
      if (acceptSuggestion) {
        const suggestion = suggestForField(missingBefore, slots, opts?.hints);
        if (suggestion) {
          Object.assign(slots, applyAnswer(missingBefore, suggestion, slots));
        }
      } else if (missingBefore === "start_date") {
        // Allow "next Monday and end 31 Dec" to fill start + end in one turn.
        const split = message.match(/\b(?:and\s+)?(?:end(?:ing)?|until|through|to)\b/i);
        if (split && split.index != null) {
          const startPart = message.slice(0, split.index).trim();
          const endPart = message
            .slice(split.index)
            .replace(/^(?:and\s+)?(?:end(?:ing)?|until|through|to)\s+/i, "")
            .trim();
          if (startPart) slots.start_date = parseDateHint(startPart) ?? startPart.slice(0, 80);
          if (endPart) slots.end_date = parseDateHint(endPart) ?? endPart.slice(0, 80);
        } else {
          Object.assign(slots, applyAnswer(missingBefore, message, slots));
        }
      } else {
        const updated = applyAnswer(missingBefore, message, slots);
        // If frequency parse failed, re-ask.
        if (missingBefore === "posting_frequency" && !updated.posting_frequency) {
          return askWithSuggestion("posting_frequency", updated, opts?.hints);
        }
        Object.assign(slots, updated);
      }
    } else if (missingBefore === "name") {
      // First turn: extract name from "create a campaign called X".
      const named = extractNamedCampaign(message);
      if (named) {
        slots.name = named;
      } else if (!/\b(?:create|start|new)\s+(?:a\s+)?campaign\b/i.test(message) || message.length > 40) {
        if (!/^(?:create|start|new)\s+(?:a\s+)?campaign\b/i.test(message.trim())) {
          slots.name = message.trim().slice(0, 120);
        }
      }
    }
  }

  const missing = nextMissingField(slots);
  if (missing) {
    // Line-by-line: ask one field with a workspace-backed suggestion when available.
    return askWithSuggestion(missing, slots, opts?.hints);
  }

  return {
    status: "confirm",
    summary: buildConfirmSummary(slots),
    slots: { ...slots, awaiting_confirm: true },
  };
}

/** Recover campaign_draft slots from prior assistant tool_calls on this thread. */
export function recoverCampaignDraftFromHistory(
  messages: Array<{ role: string; tool_calls?: Array<{ tool: string; output_data?: Record<string, unknown> | null }> }>
): CampaignDraftSlots | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m.role !== "assistant" && m.role !== "ASSISTANT") continue;
    for (let j = (m.tool_calls?.length ?? 0) - 1; j >= 0; j--) {
      const call = m.tool_calls![j];
      if (call.tool !== "campaign.collect" && call.tool !== "campaigns.create") continue;
      const data = call.output_data ?? {};
      if (call.tool === "campaigns.create") return undefined;
      const draft = data.campaign_draft;
      if (draft && typeof draft === "object") {
        return draft as CampaignDraftSlots;
      }
    }
  }
  return undefined;
}

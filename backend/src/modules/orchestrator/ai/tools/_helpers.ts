import { z, type ZodTypeAny } from "zod";
import { BadRequestError } from "../../../../shared/errors";
import type { CampaignRepository } from "../../../campaign/repositories/campaign.repository";
import {
  CampaignLifecycleStatus,
  CampaignStatus,
} from "../../../../shared/constants/campaign.constant";

/** Map common LLM key aliases to the campaign tool schema. */
export function normalizeCampaignToolInput(raw: Record<string, unknown>): Record<string, unknown> {
  const out = { ...raw };
  if (!out.campaign_id) {
    if (typeof out.id === "string" && out.id.trim()) {
      out.campaign_id = out.id.trim();
    } else if (typeof out.campaignId === "string" && out.campaignId.trim()) {
      out.campaign_id = out.campaignId.trim();
    }
  }
  return out;
}

/**
 * Resolve campaign_id when the supervisor omits it but passes goal/name/theme
 * (common when treating generateRoadmap like a create-plan call).
 */
export async function resolveCampaignIdForTool(
  repo: CampaignRepository,
  siteId: string,
  userId: string,
  raw: Record<string, unknown>
): Promise<{ campaignId: string; resolution: string } | null> {
  const input = normalizeCampaignToolInput(raw);
  const explicit = input.campaign_id;
  if (typeof explicit === "string" && explicit.trim()) {
    return { campaignId: explicit.trim(), resolution: "explicit" };
  }

  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (name) {
    const byName = await repo.findByUser(userId, siteId, { search: name });
    const exact = byName.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (exact?._id) {
      return { campaignId: exact._id.toString(), resolution: "name_exact" };
    }
    if (byName.length === 1 && byName[0]._id) {
      return { campaignId: byName[0]._id.toString(), resolution: "name_single_match" };
    }
  }

  const goal = typeof input.goal === "string" ? input.goal.trim() : "";
  if (goal) {
    const byGoal = await repo.findByUser(userId, siteId, { search: goal.slice(0, 120) });
    const exactGoal = byGoal.find((c) => c.goal === goal);
    if (exactGoal?._id) {
      return { campaignId: exactGoal._id.toString(), resolution: "goal_exact" };
    }
    if (byGoal.length === 1 && byGoal[0]._id) {
      return { campaignId: byGoal[0]._id.toString(), resolution: "goal_single_match" };
    }
  }

  const recent = await repo.findByUser(userId, siteId);
  const open = recent.filter(
    (c) =>
      c.lifecycle_status === CampaignLifecycleStatus.DRAFT ||
      c.lifecycle_status === CampaignLifecycleStatus.PLANNING ||
      c.lifecycle_status === CampaignLifecycleStatus.AWAITING_APPROVAL ||
      c.status === CampaignStatus.DRAFT
  );
  if (open.length === 1 && open[0]._id) {
    return { campaignId: open[0]._id.toString(), resolution: "single_open_campaign" };
  }

  return null;
}

/**
 * Parse opaque tool input from the supervisor using the provided Zod schema.
 * Throws a BadRequestError with a model-friendly message on validation failure
 * so the planner gets a useful follow-up signal instead of a 500.
 */
export function parseToolInput<Schema extends ZodTypeAny>(
  schema: Schema,
  raw: Record<string, unknown>,
  toolName: string
): z.infer<Schema> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw new BadRequestError(`Invalid input for '${toolName}': ${issues}`);
  }
  return parsed.data;
}

/**
 * Truncate user-visible summary strings so a single tool result never blows
 * past LLM context windows when fed back into the supervisor.
 */
export function truncateSummary(text: string, max = 1200): string {
  if (!text) return "";
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\u2026`;
}

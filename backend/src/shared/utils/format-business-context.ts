import type { WorkspaceMemoryStrategic } from "../schemas/workspace-memory.schema";
import { migrateStrategicMemory } from "./migrate-strategic-memory";

/**
 * Serialize workspace strategic profile for LLM prompts.
 * Applies lazy migration so deprecated fields still contribute.
 */
export function formatBusinessContextForPrompt(
  strategic: WorkspaceMemoryStrategic | Record<string, unknown> | null | undefined
): string {
  const s = migrateStrategicMemory(strategic);
  const lines: string[] = [];

  if (s.industries.length) lines.push(`Industries: ${s.industries.join(", ")}`);
  if (s.business_model) lines.push(`Business model: ${s.business_model.toUpperCase()}`);
  if (s.business_description?.trim()) lines.push(`Business: ${s.business_description.trim()}`);
  else if (s.business_type?.trim()) lines.push(`Business: ${s.business_type.trim()}`);

  if (s.target_audience.length) lines.push(`Audience labels: ${s.target_audience.join(", ")}`);

  if (s.customers.length) {
    const customerBlocks = s.customers.map((c, i) => {
      const parts = [`Customer ${i + 1}${c.label ? ` (${c.label})` : ""}: ${c.who}`];
      if (c.pain_points?.trim()) parts.push(`  Pain points: ${c.pain_points.trim()}`);
      if (c.success?.trim()) parts.push(`  Success looks like: ${c.success.trim()}`);
      return parts.join("\n");
    });
    lines.push(`Customers:\n${customerBlocks.join("\n")}`);
  }

  if (s.brand_voice?.trim()) lines.push(`Brand voice: ${s.brand_voice.trim()}`);
  if (s.brand_negatives?.trim()) lines.push(`Brand avoidances: ${s.brand_negatives.trim()}`);

  if (s.business_goals.length) lines.push(`Goals: ${s.business_goals.join("; ")}`);
  if (s.seo_priorities.length) lines.push(`SEO priorities: ${s.seo_priorities.join(", ")}`);
  if (s.publishing_channels.length) lines.push(`Publishing channels: ${s.publishing_channels.join(", ")}`);

  if (s.competitors.length) {
    const comp = s.competitors.map((c) => (c.notes?.trim() ? `${c.name} — ${c.notes.trim()}` : c.name)).join("; ");
    lines.push(`Competitors: ${comp}`);
  }

  return lines.filter(Boolean).join("\n");
}

/** Short one-line summary for memory_summary / casual mode. */
export function formatBusinessOneLiner(
  strategic: WorkspaceMemoryStrategic | Record<string, unknown> | null | undefined
): string {
  const s = migrateStrategicMemory(strategic);
  return (
    s.business_description?.trim() ||
    s.business_type?.trim() ||
    (s.industries.length ? s.industries.join(", ") : "") ||
    "unknown"
  );
}

import type { WorkspaceMemoryStrategic } from "../schemas/workspace-memory.schema";
import {
  customersHaveContent,
  isBusinessModel,
  normalizeCompetitors,
  normalizeCustomers,
} from "../types/business-profile";

/**
 * Lazily normalize / migrate deprecated strategic fields in memory.
 * Pure function — does not persist; callers write back when needed.
 */
export function migrateStrategicMemory(
  strategic: WorkspaceMemoryStrategic | Record<string, unknown> | null | undefined
): WorkspaceMemoryStrategic {
  const s = { ...(strategic ?? {}) } as WorkspaceMemoryStrategic;

  s.industries = Array.isArray(s.industries) ? s.industries.filter((i) => !!i?.trim()) : [];
  if (s.business_model != null && !isBusinessModel(s.business_model)) {
    delete s.business_model;
  }

  if (!s.business_description?.trim() && s.business_type?.trim()) {
    s.business_description = s.business_type.trim();
  }

  s.target_audience = Array.isArray(s.target_audience) ? s.target_audience.filter((a) => !!a?.trim()) : [];

  if (!customersHaveContent(s.customers)) {
    s.customers = normalizeCustomers(s.customers, s.target_audience);
  } else {
    s.customers = normalizeCustomers(s.customers);
  }

  s.business_goals = Array.isArray(s.business_goals) ? s.business_goals : [];
  s.seo_priorities = Array.isArray(s.seo_priorities) ? s.seo_priorities : [];
  s.publishing_channels = Array.isArray(s.publishing_channels) ? s.publishing_channels : [];

  const hasCompetitors = Array.isArray(s.competitors) && s.competitors.some((c) => c?.name?.trim());
  if (!hasCompetitors) {
    s.competitors = normalizeCompetitors(s.competitors, s.competitive_notes);
  } else {
    s.competitors = normalizeCompetitors(s.competitors);
  }

  return s;
}

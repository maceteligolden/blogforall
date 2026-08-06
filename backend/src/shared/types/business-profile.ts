/** Marketplace / go-to-market model for a workspace. */
export const BUSINESS_MODELS = ["b2b", "b2c", "c2c", "b2b2c"] as const;
export type BusinessModel = (typeof BUSINESS_MODELS)[number];

/** Persona profile for who the business serves. */
export interface CustomerPersona {
  who: string;
  pain_points?: string;
  success?: string;
  /** Optional short tag; can sync with target_audience labels. */
  label?: string;
}

/** Named competitor entry. */
export interface CompetitorEntry {
  name: string;
  notes?: string;
}

export function isBusinessModel(value: unknown): value is BusinessModel {
  return typeof value === "string" && (BUSINESS_MODELS as readonly string[]).includes(value);
}

/** Normalize competitor belief/value into a structured list. */
export function normalizeCompetitors(value: unknown, legacyNotes?: string): CompetitorEntry[] {
  if (Array.isArray(value) && value.length > 0) {
    const fromValue = value
      .map((item) => {
        if (typeof item === "string" && item.trim()) return { name: item.trim() };
        if (item && typeof item === "object" && "name" in item) {
          const name = String((item as CompetitorEntry).name ?? "").trim();
          if (!name) return null;
          const notes = (item as CompetitorEntry).notes?.trim();
          return notes ? { name, notes } : { name };
        }
        return null;
      })
      .filter((c): c is CompetitorEntry => c != null);
    if (fromValue.length > 0) return fromValue;
  }
  if (typeof value === "string" && value.trim()) {
    return migrateCompetitiveNotes(value);
  }
  if (legacyNotes?.trim()) return migrateCompetitiveNotes(legacyNotes);
  return [];
}

/** Split free-text competitive notes into competitor rows when possible. */
export function migrateCompetitiveNotes(notes: string): CompetitorEntry[] {
  const trimmed = notes.trim();
  if (!trimmed) return [];
  const lines = trimmed
    .split(/\n+/)
    .map((l) => l.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
  if (lines.length > 1 && lines.every((l) => l.length <= 80 && !l.includes(". "))) {
    return lines.map((name) => ({ name }));
  }
  return [{ name: "Notes", notes: trimmed }];
}

/** Normalize customers belief/value into persona array. */
export function normalizeCustomers(value: unknown, audienceLabels?: string[]): CustomerPersona[] {
  if (Array.isArray(value) && value.length > 0) {
    const fromValue = value
      .map((item) => {
        if (typeof item === "string" && item.trim()) {
          return { who: item.trim(), label: item.trim() };
        }
        if (item && typeof item === "object" && "who" in item) {
          const who = String((item as CustomerPersona).who ?? "").trim();
          if (!who) return null;
          const persona: CustomerPersona = { who };
          const pain = (item as CustomerPersona).pain_points?.trim();
          const success = (item as CustomerPersona).success?.trim();
          const label = (item as CustomerPersona).label?.trim();
          if (pain) persona.pain_points = pain;
          if (success) persona.success = success;
          if (label) persona.label = label;
          return persona;
        }
        return null;
      })
      .filter((c): c is CustomerPersona => c != null);
    if (fromValue.length > 0) return fromValue;
  }
  if (audienceLabels?.length) {
    return audienceLabels.filter((l) => l?.trim()).map((label) => ({ who: label.trim(), label: label.trim() }));
  }
  return [];
}

export function customersHaveContent(customers?: CustomerPersona[] | null): boolean {
  return !!customers?.some((c) => c.who?.trim());
}

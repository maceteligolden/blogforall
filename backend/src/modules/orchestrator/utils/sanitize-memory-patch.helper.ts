/**
 * Coerce LLM/user text into a valid default_word_count (300–8000).
 * Handles ranges like "800 to 1200" by averaging the bounds.
 */
export function parseDefaultWordCount(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return clampWordCount(Math.round(value));
  }
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) return undefined;

  const rangeMatch = /(\d+)\s*(?:to|-|–)\s*(\d+)/i.exec(trimmed);
  if (rangeMatch) {
    const low = parseInt(rangeMatch[1], 10);
    const high = parseInt(rangeMatch[2], 10);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      return clampWordCount(Math.round((low + high) / 2));
    }
  }

  const firstNumber = trimmed.match(/\d+/);
  if (firstNumber) {
    return clampWordCount(parseInt(firstNumber[0], 10));
  }

  return undefined;
}

function clampWordCount(n: number): number | undefined {
  if (!Number.isFinite(n) || n <= 0) return undefined;
  if (n < 300) return 300;
  if (n > 8000) return 8000;
  return n;
}

function parsePositiveInt(value: unknown, min: number, max: number): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    const n = Math.round(value);
    if (n >= min && n <= max) return n;
    return undefined;
  }
  if (typeof value === "string") {
    const match = value.match(/\d+/);
    if (!match) return undefined;
    const n = parseInt(match[0], 10);
    if (n >= min && n <= max) return n;
  }
  return undefined;
}

/**
 * Sanitize a memory patch before MongoDB write. Coerces numeric preference fields
 * that the LLM may emit as natural-language strings during onboarding.
 */
export function sanitizeMemoryPatch(patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...patch };

  if (out.preferences && typeof out.preferences === "object" && !Array.isArray(out.preferences)) {
    const prefs = { ...(out.preferences as Record<string, unknown>) };
    if ("default_word_count" in prefs) {
      const parsed = parseDefaultWordCount(prefs.default_word_count);
      if (parsed !== undefined) {
        prefs.default_word_count = parsed;
      } else {
        delete prefs.default_word_count;
      }
    }
    out.preferences = prefs;
  }

  if ("preferences.default_word_count" in out) {
    const parsed = parseDefaultWordCount(out["preferences.default_word_count"]);
    if (parsed !== undefined) {
      out["preferences.default_word_count"] = parsed;
    } else {
      delete out["preferences.default_word_count"];
    }
  }

  if (out.operational && typeof out.operational === "object" && !Array.isArray(out.operational)) {
    const op = { ...(out.operational as Record<string, unknown>) };
    if ("review_lead_time_hours" in op) {
      const parsed = parsePositiveInt(op.review_lead_time_hours, 1, 24 * 14);
      if (parsed !== undefined) {
        op.review_lead_time_hours = parsed;
      } else {
        delete op.review_lead_time_hours;
      }
    }
    out.operational = op;
  }

  if ("operational.review_lead_time_hours" in out) {
    const parsed = parsePositiveInt(out["operational.review_lead_time_hours"], 1, 24 * 14);
    if (parsed !== undefined) {
      out["operational.review_lead_time_hours"] = parsed;
    } else {
      delete out["operational.review_lead_time_hours"];
    }
  }

  return out;
}

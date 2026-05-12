import { z, type ZodTypeAny } from "zod";
import { BadRequestError } from "../../../../shared/errors";

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

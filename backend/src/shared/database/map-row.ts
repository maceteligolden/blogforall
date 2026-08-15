/** Map a Drizzle row (`id`) onto the existing entity shape (`_id`). */
export function withId<T extends { id: string }>(row: T): T & { _id: string } {
  return { ...row, _id: row.id };
}

export function withIds<T extends { id: string }>(rows: T[]): Array<T & { _id: string }> {
  return rows.map(withId);
}

export function omitUndefined<T extends Record<string, unknown>>(input: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as Partial<T>;
}

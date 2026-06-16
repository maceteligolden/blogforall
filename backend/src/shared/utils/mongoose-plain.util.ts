/**
 * Convert a Mongoose document (with toObject) or a plain object to a plain object for safe spreading.
 */
export function mongooseDocToPlain<T extends object>(doc: T): T {
  if (doc && typeof doc === "object" && "toObject" in doc) {
    const maybe = doc as { toObject?: () => T };
    if (typeof maybe.toObject === "function") {
      return maybe.toObject();
    }
  }
  return { ...doc };
}

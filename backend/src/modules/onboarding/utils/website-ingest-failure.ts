/** True when Content Strategy failed because the website was missing or unreadable. */
export function isWebsiteIngestFailure(message?: string): boolean {
  if (!message) return false;
  const normalized = message.toLowerCase();
  return normalized.includes("website url") || normalized.includes("could not read that website");
}

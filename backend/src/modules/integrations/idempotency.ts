import { INTEGRATION_PROVIDERS, type PublishDestination } from "./constants";

export function connectIdempotencyKey(provider: string, siteId: string): string {
  return `${provider}:connect:${siteId}`;
}

export function publishIdempotencyKey(provider: string, siteId: string, blogId: string, connectionId: string): string {
  return `${provider}:publish:${siteId}:${blogId}:${connectionId}`;
}

export function unpublishIdempotencyKey(
  provider: string,
  siteId: string,
  blogId: string,
  connectionId: string
): string {
  return `${provider}:unpublish:${siteId}:${blogId}:${connectionId}`;
}

export function syncIdempotencyKey(provider: string, siteId: string, connectionId: string): string {
  return `${provider}:sync:${siteId}:${connectionId}`;
}

export function normalizeDestinations(input?: string[] | null): PublishDestination[] {
  const allowed = new Set<string>([INTEGRATION_PROVIDERS.BLOGGR, INTEGRATION_PROVIDERS.FRAMER]);
  const unique: PublishDestination[] = [];
  for (const raw of input ?? []) {
    const value = raw.trim().toLowerCase();
    if (!allowed.has(value)) continue;
    const dest = value as PublishDestination;
    if (!unique.includes(dest)) unique.push(dest);
  }
  return unique.length ? unique : [INTEGRATION_PROVIDERS.BLOGGR];
}

export function maskSecret(secret: string | null | undefined): string | null {
  if (!secret) return null;
  if (secret.length <= 4) return "••••";
  return `••••${secret.slice(-4)}`;
}

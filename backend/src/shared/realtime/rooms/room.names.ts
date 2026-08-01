export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function siteRoom(siteId: string): string {
  return `site:${siteId}`;
}

export function threadRoom(siteId: string, threadId: string): string {
  return `thread:${siteId}:${threadId}`;
}

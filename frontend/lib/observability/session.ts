const SESSION_STORAGE_KEY = "bloggr_session_id";

/** Stable per-browser-tab session id for correlating frontend events with backend logs. */
export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "server";

  try {
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (existing) return existing;

    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

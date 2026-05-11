function stripControlCharacters(raw: string): string {
  let out = "";
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i);
    if (code >= 32 && code !== 127) {
      out += raw[i];
    } else {
      out += " ";
    }
  }
  return out;
}

/** Strip control chars and collapse whitespace for a safe search query. */
export function sanitizeSearchQuery(raw: string, maxLen: number): string {
  const collapsed = stripControlCharacters(raw).replace(/\s+/g, " ").trim();
  return collapsed.slice(0, maxLen);
}

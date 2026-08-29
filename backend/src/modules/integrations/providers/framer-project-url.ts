const PROJECT_ID = /^[A-Za-z0-9]{20}$/;
/** Matches slug--{20-char-id}, ignoring editor suffixes like -g4orW. */
const SLUG_THEN_ID = /^.+--([A-Za-z0-9]{20})/;

export const FRAMER_PROJECT_URL_HELP =
  "Copy the URL from the Framer editor address bar (https://framer.com/projects/Name--xxxxxxxxxxxxxxxxxxxx). Published site links like yoursite.framer.app will not work.";

function asProjectId(value: string | null | undefined): string | null {
  const raw = (value ?? "").trim();
  if (PROJECT_ID.test(raw)) return raw;
  const fromSlug = raw.match(SLUG_THEN_ID)?.[1];
  return fromSlug && PROJECT_ID.test(fromSlug) ? fromSlug : null;
}

/**
 * framer-api only accepts a 20-character project id, or an editor URL whose
 * /projects/ segment is `{slug}--{20-char-id}`.
 */
export function normalizeFramerProjectTarget(input: string): string {
  const raw = input
    .trim()
    .replace(/^['"]+|['"]+$/g, "")
    .replace(/[\u200B-\u200D\uFEFF]/g, "");
  const direct = asProjectId(raw);
  if (direct) return direct;

  const withProtocol = /^(https?:)?\/\//i.test(raw) ? raw : `https://${raw.replace(/^\/+/, "")}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(FRAMER_PROJECT_URL_HELP);
  }

  const parts = url.pathname.split("/").filter(Boolean);
  const projectsIdx = parts.findIndex((part) => part.toLowerCase() === "projects");
  if (projectsIdx >= 0) {
    const fromPath = asProjectId(decodeURIComponent(parts[projectsIdx + 1] ?? ""));
    if (fromPath) return fromPath;
  }

  for (const key of ["duplicate", "projectId", "project", "id"]) {
    const fromQuery = asProjectId(url.searchParams.get(key));
    if (fromQuery) return fromQuery;
  }

  throw new Error(FRAMER_PROJECT_URL_HELP);
}

/**
 * Production shows the waitlist homepage; `next dev` keeps the open-signup landing page.
 * Prefer NEXT_PUBLIC_NODE_ENV so local `yarn dev` can preview waitlist; fall back to NODE_ENV
 * so production builds still switch without an extra env var.
 */
export const IS_WAITLIST_MODE = (process.env.NEXT_PUBLIC_NODE_ENV ?? process.env.NODE_ENV) === "production";

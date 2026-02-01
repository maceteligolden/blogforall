/**
 * Utility functions for JWT token handling
 */

interface TokenPayload {
  userId: string;
  email: string;
  currentSiteId?: string;
}

/**
 * Decode JWT token without verification (client-side only)
 * Note: This does not verify the token signature, only decodes the payload
 */
export function decodeJWT(token: string): TokenPayload | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) {
      return null;
    }
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as TokenPayload;
  } catch (error) {
    console.error("Failed to decode JWT token:", error);
    return null;
  }
}

/**
 * Extract currentSiteId from JWT token
 */
export function getCurrentSiteIdFromToken(token: string | null): string | undefined {
  if (!token) {
    return undefined;
  }
  const decoded = decodeJWT(token);
  return decoded?.currentSiteId;
}

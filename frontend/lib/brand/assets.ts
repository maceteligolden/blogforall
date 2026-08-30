/** Public brand files from `frontend/public/Bloggr`. Paths are URL-encoded for spaces. */
export const BRAND_ASSETS = {
  logoWhite: "/Bloggr/SVG/Logo%20-%20White.svg",
  logoBlack: "/Bloggr/SVG/Logo%20-%20Black.svg",
  logoColor: "/Bloggr/4x/Logo.png",
  iconBlack: "/Bloggr/SVG/Icon%20-%20Black.svg",
  iconWhite: "/Bloggr/SVG/Icon%20-%20White.svg",
  iconColor: "/Bloggr/4x/Icon.png",
} as const;

export const BRAND_OG_IMAGE = {
  url: BRAND_ASSETS.logoColor,
  width: 2706,
  height: 1069,
  alt: "Bloggr",
} as const;

export const SITE_NAME = "Bloggr";
export const SITE_LEGAL_NAME = "Bloggr Ltd";

export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  return "https://bloggr.io";
}

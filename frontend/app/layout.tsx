import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Montserrat } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/query-provider";
import { AnalyticsProvider } from "@/lib/analytics/provider";
import { IdentifyUserProvider } from "@/lib/analytics/identify-provider";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";
import { BRAND_OG_IMAGE, SITE_LEGAL_NAME, SITE_NAME, getSiteUrl } from "@/lib/brand/assets";
import { LANDING_SEO, WAITLIST_SEO } from "@/lib/landing/landing-copy";
import { IS_WAITLIST_MODE } from "@/lib/landing/waitlist-mode";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
});

const seo = IS_WAITLIST_MODE ? WAITLIST_SEO : LANDING_SEO;
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: SITE_NAME,
  title: {
    default: seo.title,
    template: "%s | Bloggr",
  },
  description: seo.description,
  keywords: [
    "AI content strategist",
    "AI blog writer",
    "content strategy",
    "on-brand blog posts",
    "Bloggr",
  ],
  authors: [{ name: SITE_LEGAL_NAME, url: siteUrl }],
  creator: SITE_LEGAL_NAME,
  publisher: SITE_LEGAL_NAME,
  robots: {
    index: true,
    follow: true,
  },
  alternates: {
    canonical: "/",
  },
  formatDetection: {
    email: false,
    telephone: false,
    address: false,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    locale: "en_GB",
    url: "/",
    siteName: SITE_NAME,
    title: seo.title,
    description: seo.description,
    images: [
      {
        url: BRAND_OG_IMAGE.url,
        width: BRAND_OG_IMAGE.width,
        height: BRAND_OG_IMAGE.height,
        alt: BRAND_OG_IMAGE.alt,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
    images: [BRAND_OG_IMAGE.url],
  },
  category: "technology",
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en-GB">
      <body className={`${bebasNeue.variable} ${montserrat.variable} font-sans`}>
        <QueryProvider>
          <AnalyticsProvider>
            <IdentifyUserProvider>
              <ChunkErrorHandler>{children}</ChunkErrorHandler>
            </IdentifyUserProvider>
          </AnalyticsProvider>
        </QueryProvider>
      </body>
    </html>
  );
}

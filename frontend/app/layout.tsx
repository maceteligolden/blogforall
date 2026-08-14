import type { Metadata } from "next";
import { Bebas_Neue, Montserrat } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/query-provider";
import { AnalyticsProvider } from "@/lib/analytics/provider";
import { IdentifyUserProvider } from "@/lib/analytics/identify-provider";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";
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

export const metadata: Metadata = {
  title: {
    default: seo.title,
    template: "%s | Bloggr",
  },
  description: seo.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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

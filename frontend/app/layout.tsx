import type { Metadata } from "next";
import { Bebas_Neue, Montserrat } from "next/font/google";
import "./globals.css";
import { QueryProvider } from "@/lib/providers/query-provider";
import { AnalyticsProvider } from "@/lib/analytics/provider";
import { IdentifyUserProvider } from "@/lib/analytics/identify-provider";
import { ChunkErrorHandler } from "@/components/chunk-error-handler";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-display",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Bloggr - AI Blog Workspace",
  description:
    "AI-overseen blog workspace with context-aware generation, campaign planning, and scheduling—control your content strategy through conversation.",
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


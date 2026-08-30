import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { WaitlistLandingPage } from "@/components/landing/waitlist";
import { BRAND_ASSETS, BRAND_OG_IMAGE, SITE_NAME, getSiteUrl } from "@/lib/brand/assets";
import { FAQ_ITEMS, LANDING_SEO, WAITLIST_SEO } from "@/lib/landing/landing-copy";
import { IS_WAITLIST_MODE } from "@/lib/landing/waitlist-mode";

const seo = IS_WAITLIST_MODE ? WAITLIST_SEO : LANDING_SEO;
const siteUrl = getSiteUrl();

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  openGraph: {
    title: seo.title,
    description: seo.description,
    type: "website",
    url: "/",
    siteName: SITE_NAME,
    locale: "en_GB",
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
};

function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: siteUrl,
    logo: `${siteUrl}${BRAND_ASSETS.logoColor}`,
    description: seo.description,
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    url: siteUrl,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: seo.description,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  };

  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organization) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(software) }} />
      {!IS_WAITLIST_MODE && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
      )}
    </>
  );
}

export default function Home() {
  return (
    <>
      <JsonLd />
      {IS_WAITLIST_MODE ? <WaitlistLandingPage /> : <LandingPage />}
    </>
  );
}

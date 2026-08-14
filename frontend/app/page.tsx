import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { WaitlistLandingPage } from "@/components/landing/waitlist";
import { FAQ_ITEMS, LANDING_SEO, WAITLIST_SEO } from "@/lib/landing/landing-copy";
import { IS_WAITLIST_MODE } from "@/lib/landing/waitlist-mode";

const seo = IS_WAITLIST_MODE ? WAITLIST_SEO : LANDING_SEO;

export const metadata: Metadata = {
  title: seo.title,
  description: seo.description,
  openGraph: {
    title: seo.title,
    description: seo.description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: seo.title,
    description: seo.description,
  },
};

function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bloggr",
    description: seo.description,
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Bloggr",
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

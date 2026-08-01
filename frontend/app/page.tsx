import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";
import { FAQ_ITEMS, LANDING_SEO } from "@/lib/landing/landing-copy";

export const metadata: Metadata = {
  title: LANDING_SEO.title,
  description: LANDING_SEO.description,
  openGraph: {
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: LANDING_SEO.title,
    description: LANDING_SEO.description,
  },
};

function JsonLd() {
  const organization = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Bloggr",
    description: LANDING_SEO.description,
  };

  const software = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Bloggr",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: LANDING_SEO.description,
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq) }} />
    </>
  );
}

export default function Home() {
  return (
    <>
      <JsonLd />
      <LandingPage />
    </>
  );
}

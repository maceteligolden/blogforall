import {
  INTEGRATION_CATEGORIES,
  INTEGRATION_CATALOG_STATUS,
  INTEGRATION_PROVIDERS,
  type IntegrationCategory,
  type IntegrationProviderId,
} from "./constants";

export type CatalogEntry = {
  provider: IntegrationProviderId;
  label: string;
  description: string;
  category: IntegrationCategory;
  catalogStatus: (typeof INTEGRATION_CATALOG_STATUS)[keyof typeof INTEGRATION_CATALOG_STATUS];
  docsUrl?: string;
};

export const INTEGRATION_CATALOG: CatalogEntry[] = [
  {
    provider: INTEGRATION_PROVIDERS.FRAMER,
    label: "Framer",
    description: "Publish posts to a Framer CMS collection and deploy your live site.",
    category: INTEGRATION_CATEGORIES.CMS,
    catalogStatus: INTEGRATION_CATALOG_STATUS.AVAILABLE,
    docsUrl: "https://www.framer.com/developers/server-api-quick-start",
  },
  {
    provider: INTEGRATION_PROVIDERS.WORDPRESS,
    label: "WordPress",
    description: "Push posts to a WordPress site.",
    category: INTEGRATION_CATEGORIES.CMS,
    catalogStatus: INTEGRATION_CATALOG_STATUS.COMING_SOON,
  },
  {
    provider: INTEGRATION_PROVIDERS.WEBFLOW,
    label: "Webflow",
    description: "Publish to a Webflow CMS collection.",
    category: INTEGRATION_CATEGORIES.CMS,
    catalogStatus: INTEGRATION_CATALOG_STATUS.COMING_SOON,
  },
  {
    provider: INTEGRATION_PROVIDERS.GHOST,
    label: "Ghost",
    description: "Publish to a Ghost publication.",
    category: INTEGRATION_CATEGORIES.CMS,
    catalogStatus: INTEGRATION_CATALOG_STATUS.COMING_SOON,
  },
  {
    provider: INTEGRATION_PROVIDERS.GOOGLE_ANALYTICS,
    label: "Google Analytics",
    description: "Connect a GA4 property for post performance.",
    category: INTEGRATION_CATEGORIES.ANALYTICS,
    catalogStatus: INTEGRATION_CATALOG_STATUS.COMING_SOON,
  },
  {
    provider: INTEGRATION_PROVIDERS.GOOGLE_SEARCH_CONSOLE,
    label: "Google Search Console",
    description: "Import search impressions and queries.",
    category: INTEGRATION_CATEGORIES.ANALYTICS,
    catalogStatus: INTEGRATION_CATALOG_STATUS.COMING_SOON,
  },
];

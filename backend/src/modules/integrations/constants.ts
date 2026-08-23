export const INTEGRATION_PROVIDERS = {
  BLOGGR: "bloggr",
  FRAMER: "framer",
  WORDPRESS: "wordpress",
  WEBFLOW: "webflow",
  GHOST: "ghost",
  GOOGLE_ANALYTICS: "google_analytics",
  GOOGLE_SEARCH_CONSOLE: "google_search_console",
} as const;

export type IntegrationProviderId = (typeof INTEGRATION_PROVIDERS)[keyof typeof INTEGRATION_PROVIDERS];

export const CMS_DESTINATIONS = [INTEGRATION_PROVIDERS.BLOGGR, INTEGRATION_PROVIDERS.FRAMER] as const;
export type PublishDestination = (typeof CMS_DESTINATIONS)[number];

export const INTEGRATION_CATEGORIES = {
  CMS: "cms",
  ANALYTICS: "analytics",
} as const;

export type IntegrationCategory = (typeof INTEGRATION_CATEGORIES)[keyof typeof INTEGRATION_CATEGORIES];

export const INTEGRATION_CATALOG_STATUS = {
  AVAILABLE: "available",
  COMING_SOON: "coming_soon",
} as const;

export const CONNECTION_STATUS = {
  CONNECTED: "connected",
  ERROR: "error",
  DISCONNECTED: "disconnected",
} as const;

export type ConnectionStatus = (typeof CONNECTION_STATUS)[keyof typeof CONNECTION_STATUS];

export const DELIVERY_STATUS = {
  PENDING: "pending",
  PUBLISHING: "publishing",
  PUBLISHED: "published",
  FAILED: "failed",
  UNPUBLISHED: "unpublished",
  CANCELLED: "cancelled",
} as const;

export type DeliveryStatus = (typeof DELIVERY_STATUS)[keyof typeof DELIVERY_STATUS];

export const INTEGRATION_PUBLISH_MAX_ATTEMPTS = 5;
export const REQUIRED_FRAMER_FIELDS = ["title", "content"] as const;
export const OPTIONAL_FRAMER_FIELDS = ["slug", "excerpt", "featured_image", "published_at"] as const;
export const ALL_FRAMER_MAPPABLE_FIELDS = [...REQUIRED_FRAMER_FIELDS, ...OPTIONAL_FRAMER_FIELDS] as const;

export type FramerMappableField = (typeof ALL_FRAMER_MAPPABLE_FIELDS)[number];

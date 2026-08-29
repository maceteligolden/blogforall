import apiClient from "../client";
import { API_ENDPOINTS } from "../config";

export type IntegrationCatalogStatus = "available" | "coming_soon";
export type IntegrationAction = "configure" | "manage" | "coming_soon";
export type IntegrationCategory = "cms" | "analytics";

export interface IntegrationCatalogItem {
  provider: string;
  label: string;
  description: string;
  category: IntegrationCategory;
  catalogStatus: IntegrationCatalogStatus;
  docsUrl?: string;
  connectionStatus: "connected" | "error" | "disconnected";
  connected: boolean;
  action: IntegrationAction;
}

export interface PublishDestinationOption {
  provider: string;
  label: string;
}

export interface FramerCollectionField {
  id: string;
  name: string;
  type: string;
}

export interface FramerCollection {
  id: string;
  name: string;
  fields: FramerCollectionField[];
}

export interface FramerConnectionPublic {
  id: string;
  provider: string;
  status: string;
  config: {
    projectUrl?: string;
    collectionId?: string;
    collectionName?: string;
    fieldMap: Record<string, string>;
    autoDeploy: boolean;
  };
  maskedApiKey: string | null;
  lastVerifiedAt?: string | null;
  lastError?: string | null;
  connectedAt?: string;
}

export interface IntegrationDelivery {
  id: string;
  blog_id: string;
  provider: string;
  status: string;
  external_item_id?: string | null;
  external_url?: string | null;
  deployment_id?: string | null;
  attempts: number;
  last_error?: string | null;
  last_synced_at?: string | null;
  published_at?: string | null;
  updated_at?: string;
}

export interface FramerManagePayload {
  connection: FramerConnectionPublic;
  deliveries: IntegrationDelivery[];
  metrics: {
    published: number;
    failed: number;
    pending: number;
    lastPublishedAt: string | null;
    lastSyncedAt: string | null;
  };
}

export class IntegrationService {
  static async list(siteId: string): Promise<IntegrationCatalogItem[]> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.INTEGRATIONS(siteId));
    const data = response.data?.data ?? response.data;
    return data?.integrations ?? [];
  }

  static async listDestinations(siteId: string): Promise<PublishDestinationOption[]> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.INTEGRATION_DESTINATIONS(siteId));
    const data = response.data?.data ?? response.data;
    return data?.destinations ?? [{ provider: "bloggr", label: "Bloggr" }];
  }

  static async testFramer(siteId: string, input: { projectUrl: string; apiKey: string }) {
    const response = await apiClient.post(API_ENDPOINTS.SITES.FRAMER_TEST(siteId), input, { timeout: 60000 });
    return (response.data?.data ?? response.data) as { projectName?: string; collections: FramerCollection[] };
  }

  static async saveFramer(
    siteId: string,
    input: {
      projectUrl: string;
      apiKey: string;
      collectionId: string;
      collectionName: string;
      fieldMap: Record<string, string>;
      autoDeploy?: boolean;
    }
  ) {
    const response = await apiClient.post(API_ENDPOINTS.SITES.FRAMER(siteId), input, { timeout: 60000 });
    return response.data?.data ?? response.data;
  }

  static async getFramer(siteId: string): Promise<FramerManagePayload> {
    const response = await apiClient.get(API_ENDPOINTS.SITES.FRAMER(siteId));
    return (response.data?.data ?? response.data) as FramerManagePayload;
  }

  static async syncFramer(siteId: string): Promise<FramerManagePayload> {
    const response = await apiClient.post(API_ENDPOINTS.SITES.FRAMER_SYNC(siteId), {}, { timeout: 60000 });
    return (response.data?.data ?? response.data) as FramerManagePayload;
  }

  static async disconnectFramer(siteId: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.SITES.FRAMER(siteId));
  }
}

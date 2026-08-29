import { injectable } from "tsyringe";
import { logger } from "../../../shared/utils/logger";
import type { FramerMappableField } from "../constants";
import { framerMappedFieldValues } from "../services/framer-publish-payload";
import { normalizeFramerProjectTarget } from "./framer-project-url";

export type FramerCollectionField = {
  id: string;
  name: string;
  type: string;
};

export type FramerCollectionSummary = {
  id: string;
  name: string;
  fields: FramerCollectionField[];
};

export type FramerPublishPayload = {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  publishedAt?: Date;
  fieldMap: Partial<Record<FramerMappableField, string>>;
  existingItemId?: string;
};

export type FramerPublishResult = {
  itemId?: string;
  url?: string;
  deploymentId?: string;
};

type FramerFieldValue =
  | { type: "string"; value: string }
  | { type: "formattedText"; value: string }
  | { type: "image"; value: string }
  | { type: "date"; value: string }
  | { type: "link"; value: string };

type FramerSdk = {
  connect: (projectUrl: string, token?: string) => Promise<FramerSession>;
};

type FramerSession = {
  disconnect: () => Promise<void>;
  getCollections: () => Promise<FramerCollectionLike[]>;
  getProjectInfo?: () => Promise<{ name?: string }>;
  publish: () => Promise<{
    deployment?: { id?: string };
    hostnames?: Array<{ name?: string; url?: string; hostname?: string }>;
  }>;
  deploy: (deploymentId: string) => Promise<unknown>;
};

type FramerCollectionLike = {
  id: string;
  name?: string;
  fields?: FramerCollectionField[];
  getFields?: () => Promise<FramerCollectionField[]> | FramerCollectionField[];
  getItems: () => Promise<Array<{ id: string; slug?: string }>>;
  addItems: (
    items: Array<{ id?: string; slug: string; fieldData: Record<string, FramerFieldValue> }>
  ) => Promise<Array<{ id?: string }> | void>;
};

/** ts-node/tsc emit CJS `require()` for `import()`; framer-api is ESM with top-level await. */
const importEsm = new Function("specifier", "return import(specifier)") as (
  specifier: string
) => Promise<Record<string, unknown>>;

async function loadSdk(): Promise<FramerSdk> {
  const mod = await importEsm("framer-api");
  const sdk = (typeof mod.connect === "function" ? mod : mod.default) as FramerSdk | undefined;
  if (!sdk || typeof sdk.connect !== "function") {
    throw new Error("framer-api does not export connect");
  }
  return sdk;
}

async function withFramer<T>(
  projectUrl: string,
  apiKey: string,
  callback: (framer: FramerSession) => Promise<T>
): Promise<T> {
  const sdk = await loadSdk();
  const framer = await sdk.connect(normalizeFramerProjectTarget(projectUrl), apiKey);
  try {
    return await callback(framer);
  } finally {
    await framer.disconnect().catch(() => undefined);
  }
}

function fieldValue(type: string, value: string): FramerFieldValue {
  const normalized = type.toLowerCase();
  if (normalized.includes("formatted") || normalized.includes("rich") || normalized === "formattedtext") {
    return { type: "formattedText", value };
  }
  if (normalized.includes("image") || normalized.includes("file")) {
    return { type: "image", value };
  }
  if (normalized.includes("date")) {
    return { type: "date", value };
  }
  if (normalized.includes("link") || normalized.includes("url")) {
    return { type: "link", value };
  }
  return { type: "string", value };
}

async function readFields(collection: FramerCollectionLike): Promise<FramerCollectionField[]> {
  if (Array.isArray(collection.fields) && collection.fields.length) {
    return collection.fields.map((field) => ({
      id: field.id,
      name: field.name,
      type: field.type,
    }));
  }
  if (typeof collection.getFields === "function") {
    const fields = await collection.getFields();
    return (fields ?? []).map((field) => ({
      id: field.id,
      name: field.name,
      type: String(field.type ?? "string"),
    }));
  }
  return [];
}

function hostnameUrl(result: Awaited<ReturnType<FramerSession["publish"]>>): string | undefined {
  const host = result.hostnames?.[0];
  if (!host) return undefined;
  if (host.url) return host.url;
  const name = host.name ?? host.hostname;
  if (!name) return undefined;
  return name.startsWith("http") ? name : `https://${name}`;
}

@injectable()
export class FramerProvider {
  async testConnection(
    projectUrl: string,
    apiKey: string
  ): Promise<{ projectName?: string; collections: FramerCollectionSummary[] }> {
    return withFramer(projectUrl, apiKey, async (framer) => {
      const [collections, info] = await Promise.all([
        framer.getCollections(),
        framer.getProjectInfo ? framer.getProjectInfo() : Promise.resolve(undefined),
      ]);
      const summaries: FramerCollectionSummary[] = [];
      for (const collection of collections ?? []) {
        summaries.push({
          id: collection.id,
          name: collection.name ?? collection.id,
          fields: await readFields(collection),
        });
      }
      return { projectName: info?.name, collections: summaries };
    });
  }

  async publishItem(
    projectUrl: string,
    apiKey: string,
    collectionId: string,
    payload: FramerPublishPayload,
    autoDeploy: boolean
  ): Promise<FramerPublishResult> {
    return withFramer(projectUrl, apiKey, async (framer) => {
      const collections = await framer.getCollections();
      const collection = collections.find((item) => item.id === collectionId);
      if (!collection) {
        throw new Error("Framer CMS collection not found. Reconfigure the integration.");
      }
      const fields = await readFields(collection);
      const fieldById = new Map(fields.map((field) => [field.id, field]));
      const fieldData: Record<string, FramerFieldValue> = {};
      for (const [blogField, value] of framerMappedFieldValues(payload)) {
        const fieldId = payload.fieldMap[blogField];
        if (!fieldId || value == null || value === "") continue;
        const field = fieldById.get(fieldId);
        fieldData[fieldId] = fieldValue(field?.type ?? "string", value);
      }
      const added = await collection.addItems([
        {
          id: payload.existingItemId,
          slug: payload.slug,
          fieldData,
        },
      ]);
      const itemId = (Array.isArray(added) ? added[0]?.id : undefined) ?? payload.existingItemId ?? undefined;
      const published = await framer.publish();
      const deploymentId = published.deployment?.id;
      if (autoDeploy && deploymentId) {
        await framer.deploy(deploymentId);
      }
      const baseUrl = hostnameUrl(published);
      return {
        itemId,
        deploymentId,
        url: baseUrl && payload.slug ? `${baseUrl.replace(/\/$/, "")}/${payload.slug}` : baseUrl,
      };
    });
  }

  async listItems(
    projectUrl: string,
    apiKey: string,
    collectionId: string
  ): Promise<Array<{ id: string; slug?: string }>> {
    return withFramer(projectUrl, apiKey, async (framer) => {
      const collections = await framer.getCollections();
      const collection = collections.find((item) => item.id === collectionId);
      if (!collection) return [];
      return collection.getItems();
    });
  }
}

export function logFramerError(error: unknown, extra: Record<string, unknown>): void {
  logger.error(
    "Framer provider error",
    error instanceof Error ? error : new Error(String(error)),
    extra,
    "FramerProvider"
  );
}

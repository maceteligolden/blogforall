"use client";

import type { AnalyticsEventName } from "../events";
import { toGa4EventName } from "../ga4-event-map";

const MAX_GA4_PARAMS = 25;
const GA4_PII_KEYS = new Set(["email", "first_name", "last_name", "name", "phone", "phone_number"]);

let initialized = false;
let measurementId = "";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

function getMeasurementId(): string {
  return process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID?.trim() ?? "";
}

function isProduction(): boolean {
  const env = process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV;
  return env === "production";
}

export function isGa4Enabled(): boolean {
  if (typeof window === "undefined") return false;
  if (process.env.NEXT_PUBLIC_GA_ENABLED === "false") return false;
  return Boolean(getMeasurementId());
}

function ensureGtagStub(): void {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== "function") {
    window.gtag = function gtagStub() {
      // gtag.js replays this queue; it expects Arguments, not a rest-array.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
}

function gtag(...args: unknown[]): void {
  if (typeof window === "undefined") return;
  ensureGtagStub();
  window.gtag!(...args);
}

function injectGtagScript(id: string): void {
  const src = `https://www.googletagmanager.com/gtag/js?id=${id}`;
  if (document.querySelector(`script[src="${src}"]`)) return;

  const script = document.createElement("script");
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

export function initGA4(): void {
  if (initialized || !isGa4Enabled()) return;

  measurementId = getMeasurementId();
  ensureGtagStub();
  injectGtagScript(measurementId);

  gtag("js", new Date());
  gtag("consent", "default", { analytics_storage: "granted" });
  gtag("config", measurementId, {
    send_page_view: false,
    anonymize_ip: true,
    debug_mode: !isProduction(),
  });

  initialized = true;
}

function toGa4Params(props: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(props)) {
    if (Object.keys(out).length >= MAX_GA4_PARAMS) break;
    if (key.startsWith("$")) continue;
    if (GA4_PII_KEYS.has(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      out[key] = value;
    }
  }
  return out;
}

export function captureGa4Event(event: AnalyticsEventName, properties: Record<string, unknown>): void {
  if (!isGa4Enabled()) return;
  if (!initialized) initGA4();
  const name = toGa4EventName(event);
  if (!name) return;
  gtag("event", name, toGa4Params(properties));
}

export function captureGa4PageView(path: string): void {
  if (!isGa4Enabled()) return;
  if (!initialized) initGA4();
  const params: Record<string, string> = {
    page_path: path,
    page_location: typeof window !== "undefined" ? window.location.href : path,
  };
  if (typeof document !== "undefined" && document.title) {
    params.page_title = document.title;
  }
  gtag("event", "page_view", params);
}

export function identifyGa4User(userId: string, traits?: { plan?: string; workspaceId?: string | null }): void {
  if (!isGa4Enabled()) return;
  if (!initialized) initGA4();

  gtag("config", measurementId, {
    user_id: userId,
    send_page_view: false,
  });

  const userProperties: Record<string, string> = {};
  if (traits?.plan) userProperties.plan_type = traits.plan;
  if (traits?.workspaceId) userProperties.workspace_id = traits.workspaceId;
  if (Object.keys(userProperties).length > 0) {
    gtag("set", "user_properties", userProperties);
  }
}

export function setGa4Workspace(workspaceId: string): void {
  if (!isGa4Enabled()) return;
  if (!initialized) initGA4();
  gtag("set", "user_properties", { workspace_id: workspaceId });
}

export function resetGa4(): void {
  if (!isGa4Enabled() || !initialized) return;
  gtag("set", { user_id: undefined });
  gtag("set", "user_properties", { plan_type: null, workspace_id: null });
  gtag("config", measurementId, {
    user_id: undefined,
    send_page_view: false,
  });
}

import { BaseEntity } from "../interfaces";

export interface Plan extends BaseEntity {
  stripe_price_id?: string;
  name: string;
  price: number;
  currency?: string;
  interval?: "month" | "year" | "free";
  metadata?: Record<string, unknown>;
  limits: {
    blogPosts: number;
    apiCallsPerMonth: number;
    storageGB: number;
    maxSitesAllowed: number;
    [key: string]: number;
  };
  features: string[];
  isActive: boolean;
}

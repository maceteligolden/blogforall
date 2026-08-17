import { BaseEntity } from "../interfaces";
import { SiteStatus } from "../constants";

export interface Site extends BaseEntity {
  name: string;
  description?: string;
  slug: string;
  public_id: string;
  owner: string;
  status: SiteStatus;
  website_url?: string;
  created_at: Date;
  updated_at: Date;
}

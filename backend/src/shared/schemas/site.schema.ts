import { BaseEntity } from "../interfaces";
import { SiteStatus } from "../constants";

export interface Site extends BaseEntity {
  name: string;
  description?: string;
  slug: string;
  public_id: string;
  owner: string;
  status: SiteStatus;
  created_at: Date;
  updated_at: Date;
}

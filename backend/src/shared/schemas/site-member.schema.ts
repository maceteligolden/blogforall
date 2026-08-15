import { BaseEntity } from "../interfaces";
import { SiteMemberRole } from "../constants";

export interface SiteMember extends BaseEntity {
  site_id: string;
  user_id: string;
  role: SiteMemberRole;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
}

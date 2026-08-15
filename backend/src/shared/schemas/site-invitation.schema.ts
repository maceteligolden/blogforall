import { BaseEntity } from "../interfaces";
import { SiteMemberRole, InvitationStatus } from "../constants";

export interface SiteInvitation extends BaseEntity {
  site_id: string;
  email: string;
  role: SiteMemberRole;
  token: string;
  status: InvitationStatus;
  invited_by: string;
  expires_at: Date;
  accepted_at?: Date;
  created_at: Date;
  updated_at: Date;
}

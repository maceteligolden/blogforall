import { SiteMemberRole, InvitationStatus } from "../../../shared/constants";

export interface CreateInvitationInput {
  email: string;
  role: SiteMemberRole;
}

export interface SiteInvitationWithSite {
  _id: string;
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
  site?: {
    _id: string;
    name: string;
    slug: string;
  };
}

export interface SiteInvitationPreview {
  site_name: string;
  inviter_name: string;
  role: SiteMemberRole;
  email: string;
  status: InvitationStatus;
  expires_at: Date;
  is_expired: boolean;
  requires_signup: boolean;
}

export interface SiteInvitationListItem {
  _id: string;
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
  is_expired: boolean;
}

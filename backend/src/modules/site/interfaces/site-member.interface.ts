import { SiteMemberRole } from "../../../shared/constants";

export interface AddMemberInput {
  user_id: string;
  role: SiteMemberRole;
}

export interface UpdateMemberRoleInput {
  role: SiteMemberRole;
}

export interface SiteMemberWithUser {
  _id: string;
  site_id: string;
  user_id: string;
  role: SiteMemberRole;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
  user?: {
    _id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

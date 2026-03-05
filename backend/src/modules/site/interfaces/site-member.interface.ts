import { SiteMemberRole } from "../../../shared/constants";

export interface AddMemberInput {
  user_id: string;
  role: SiteMemberRole;
}

export interface UpdateMemberRoleInput {
  role: SiteMemberRole;
}

export interface GetMembersOptions {
  siteId: string;
  userId: string;
}

export interface AddMemberOptions {
  siteId: string;
  userId: string;
  input: AddMemberInput;
}

export interface UpdateMemberRoleOptions {
  siteId: string;
  targetUserId: string;
  requesterUserId: string;
  input: UpdateMemberRoleInput;
}

export interface RemoveMemberOptions {
  siteId: string;
  targetUserId: string;
  requesterUserId: string;
}

export interface SiteMemberWithUser {
  _id: string;
  site_id: string;
  user_id: string;
  role: SiteMemberRole;
  joined_at: Date;
  created_at: Date;
  updated_at: Date;
  posts_count?: number;
  user?: {
    _id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
}

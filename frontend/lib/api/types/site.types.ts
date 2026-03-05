export interface Site {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  owner: string;
  created_at: Date;
  updated_at: Date;
}

export interface CreateSiteRequest {
  name: string;
  description?: string;
}

export interface UpdateSiteRequest {
  name?: string;
  description?: string;
}

export interface SiteMember {
  _id: string;
  site_id: string;
  user_id: string;
  role: "owner" | "admin" | "editor" | "viewer";
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

export interface AddMemberRequest {
  user_id: string;
  role: "admin" | "editor" | "viewer";
}

export interface UpdateMemberRoleRequest {
  role: "admin" | "editor" | "viewer";
}

export interface SiteWithMemberCount extends Site {
  memberCount?: number;
}

/** @deprecated Use SiteWithMemberCount */
export interface SiteWithMembers extends Site {
  memberCount?: number;
}

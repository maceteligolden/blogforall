export interface CreateSiteInput {
  name: string;
  description?: string;
  website_url?: string;
}

export interface UpdateSiteInput {
  name?: string;
  description?: string;
  website_url?: string;
}

export interface EnsureDefaultWorkspaceInput {
  name?: string;
  website_url?: string;
}

export interface SiteWithMembers {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  owner: string;
  created_at: Date;
  updated_at: Date;
  memberCount?: number;
}

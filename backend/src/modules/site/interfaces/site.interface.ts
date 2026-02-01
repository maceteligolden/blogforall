export interface CreateSiteInput {
  name: string;
  description?: string;
}

export interface UpdateSiteInput {
  name?: string;
  description?: string;
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

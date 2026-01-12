export interface CreateCategoryInput {
  name: string;
  description?: string;
  parent?: string;
  color?: string;
}

export interface UpdateCategoryInput {
  name?: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active?: boolean;
}

export interface CategoryTreeItem {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active: boolean;
  children?: CategoryTreeItem[];
  created_at?: Date;
  updated_at?: Date;
}

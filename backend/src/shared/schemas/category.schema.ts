import { BaseEntity } from "../interfaces";

export interface Category extends BaseEntity {
  site_id: string;
  name: string;
  slug: string;
  description?: string;
  parent?: string;
  color?: string;
  is_active: boolean;
}

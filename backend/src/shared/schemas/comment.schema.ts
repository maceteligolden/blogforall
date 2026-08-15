import { BaseEntity } from "../interfaces";

export interface Comment extends BaseEntity {
  blog: string;
  author_name: string;
  author_email?: string;
  author_id?: string;
  content: string;
  parent_comment?: string;
  is_approved: boolean;
  likes: number;
  liked_by: string[];
}

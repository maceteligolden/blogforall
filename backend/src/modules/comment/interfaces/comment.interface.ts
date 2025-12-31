export interface CreateCommentInput {
  blog: string;
  author_name: string;
  author_email?: string;
  content: string;
  parent_comment?: string;
}

export interface UpdateCommentInput {
  content?: string;
  is_approved?: boolean;
}

export interface CommentQueryFilters {
  blog?: string;
  author_id?: string;
  is_approved?: boolean;
  page?: number;
  limit?: number;
}


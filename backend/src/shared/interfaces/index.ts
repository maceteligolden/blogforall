export interface BaseEntity {
  _id?: string;
  created_at?: Date;
  updated_at?: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueryFilters {
  search?: string;
  [key: string]: unknown;
}


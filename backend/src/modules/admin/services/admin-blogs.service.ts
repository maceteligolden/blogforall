import { injectable } from "tsyringe";
import { BlogRepository } from "../../blog/repositories/blog.repository";
import { UserRepository } from "../../auth/repositories/user.repository";
import type { AdminPaginationQueryInput } from "../validations/admin.validation";

export interface AdminBlogListItem {
  id: string;
  title: string;
  slug: string;
  status: string;
  site_id: string;
  created_at?: Date;
  author: {
    id: string;
    email: string;
    name: string;
  } | null;
}

@injectable()
export class AdminBlogsService {
  constructor(
    private readonly blogRepository: BlogRepository,
    private readonly userRepository: UserRepository
  ) {}

  async listBlogs(query: AdminPaginationQueryInput): Promise<{
    data: AdminBlogListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const result = await this.blogRepository.findAllAcrossSites(query);
    const authorIds = Array.from(new Set(result.data.map((b) => b.author)));
    const authors = await this.userRepository.findByIds(authorIds);
    const authorMap = authors.reduce<Record<string, { email: string; name: string }>>((acc, author) => {
      acc[author._id!.toString()] = {
        email: author.email,
        name: `${author.first_name} ${author.last_name}`.trim(),
      };
      return acc;
    }, {});

    return {
      data: result.data.map((blog) => ({
        id: blog._id!.toString(),
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
        site_id: blog.site_id,
        created_at: blog.created_at,
        author: authorMap[blog.author]
          ? {
              id: blog.author,
              email: authorMap[blog.author].email,
              name: authorMap[blog.author].name,
            }
          : null,
      })),
      pagination: result.pagination,
    };
  }

  async listBlogsByUser(
    userId: string,
    query: AdminPaginationQueryInput
  ): Promise<{
    data: AdminBlogListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const result = await this.blogRepository.findByAuthorAcrossSites(userId, query);
    const user = await this.userRepository.findById(userId);
    const author =
      user == null
        ? null
        : {
            id: userId,
            email: user.email,
            name: `${user.first_name} ${user.last_name}`.trim(),
          };

    return {
      data: result.data.map((blog) => ({
        id: blog._id!.toString(),
        title: blog.title,
        slug: blog.slug,
        status: blog.status,
        site_id: blog.site_id,
        created_at: blog.created_at,
        author,
      })),
      pagination: result.pagination,
    };
  }
}

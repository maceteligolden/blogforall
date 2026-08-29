import { clampBlogExcerpt } from "../../blog/utils/excerpt.util";
import { htmlToPlainText } from "../../../shared/utils/content-blocks.util";
import type { FramerMappableField } from "../constants";

export type FramerPublishSource = {
  slug?: string | null;
  title: string;
  content?: string | null;
  excerpt?: string | null;
  featured_image?: string | null;
  published_at?: Date | null;
};

export type DerivedFramerPublishValues = {
  slug: string;
  title: string;
  content: string;
  excerpt?: string;
  featuredImage?: string;
  publishedAt: Date;
};

/** Same rules as BlogService.generateSlug */
export function slugifyBlogTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function deriveFramerPublishValues(
  blog: FramerPublishSource,
  now: Date = new Date()
): DerivedFramerPublishValues {
  const slug = blog.slug?.trim() || slugifyBlogTitle(blog.title || "") || "post";
  const excerptSource = blog.excerpt?.trim() || htmlToPlainText(blog.content || "");
  const excerpt = clampBlogExcerpt(excerptSource) || undefined;
  const featuredImage = blog.featured_image?.trim() || undefined;

  return {
    slug,
    title: blog.title,
    content: blog.content || "",
    excerpt,
    featuredImage,
    publishedAt: blog.published_at ?? now,
  };
}

export function framerMappedFieldValues(
  payload: Pick<DerivedFramerPublishValues, "slug" | "title" | "content" | "excerpt" | "featuredImage"> & {
    publishedAt?: Date;
  }
): Array<[FramerMappableField, string | undefined]> {
  return [
    ["title", payload.title],
    ["content", payload.content],
    ["slug", payload.slug],
    ["excerpt", payload.excerpt],
    ["featured_image", payload.featuredImage],
    ["published_at", payload.publishedAt?.toISOString()],
  ];
}

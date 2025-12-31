"use client";

import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useBlog } from "@/lib/hooks/use-blog";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Breadcrumb } from "@/components/layout/breadcrumb";

export default function ViewBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: blog, isLoading } = useBlog(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <p className="text-gray-400 mb-4">Blog not found</p>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => router.push("/dashboard/blogs")}
          >
            Back to Blogs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Blogs", href: "/dashboard/blogs" },
            { label: blog.title || "View Blog" },
          ]}
        />
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display text-white">View Blog</h1>
          <Link href={`/dashboard/blogs/${id}`}>
            <Button className="bg-primary hover:bg-primary/90 text-white">Edit</Button>
          </Link>
        </div>
      </div>

      <main className="max-w-6xl mx-auto px-6 lg:px-8 pb-8">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
          {/* Status Badge */}
          <div className="mb-6">
            <span
              className={`px-3 py-1 text-sm rounded ${
                blog.status === "published"
                  ? "bg-green-900/30 text-green-400 border border-green-800"
                  : blog.status === "draft"
                    ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800"
                    : "bg-gray-800 text-gray-400 border border-gray-700"
              }`}
            >
              {blog.status}
            </span>
          </div>

          {/* Title */}
          <h1 className="text-4xl font-bold mb-4 text-white">{blog.title}</h1>

          {/* Meta Info */}
          <div className="flex items-center space-x-6 text-sm text-gray-400 mb-6">
            <span>{blog.views || 0} views</span>
            <span>{blog.likes || 0} likes</span>
            {blog.created_at && (
              <span>Created: {new Date(blog.created_at).toLocaleDateString()}</span>
            )}
            {blog.updated_at && (
              <span>Updated: {new Date(blog.updated_at).toLocaleDateString()}</span>
            )}
          </div>

          {/* Featured Image */}
          {blog.featured_image && (
            <div className="mb-6 relative w-full h-64 rounded-lg overflow-hidden">
              <Image
                src={blog.featured_image}
                alt={blog.title}
                fill
                className="object-cover"
                unoptimized={blog.featured_image.includes("localhost")}
              />
            </div>
          )}

          {/* Excerpt */}
          {blog.excerpt && (
            <div className="mb-6">
              <p className="text-lg text-gray-300 italic">{blog.excerpt}</p>
            </div>
          )}

          {/* Content */}
          <div
            className="blog-content-view"
            dangerouslySetInnerHTML={{ __html: blog.content }}
          />
          <style jsx global>{`
            .blog-content-view {
              line-height: 1.8;
              color: #e5e7eb;
            }

            .blog-content-view h1,
            .blog-content-view h2,
            .blog-content-view h3,
            .blog-content-view h4,
            .blog-content-view h5,
            .blog-content-view h6 {
              color: #ffffff;
              font-weight: bold;
              margin-top: 2rem;
              margin-bottom: 1rem;
              line-height: 1.3;
            }

            .blog-content-view h1 {
              font-size: 2.5rem;
              border-bottom: 2px solid #374151;
              padding-bottom: 0.5rem;
            }

            .blog-content-view h2 {
              font-size: 2rem;
            }

            .blog-content-view h3 {
              font-size: 1.75rem;
            }

            .blog-content-view h4 {
              font-size: 1.5rem;
            }

            .blog-content-view h5 {
              font-size: 1.25rem;
            }

            .blog-content-view h6 {
              font-size: 1.125rem;
            }

            .blog-content-view p {
              margin: 1rem 0;
              line-height: 1.8;
            }

            .blog-content-view ul,
            .blog-content-view ol {
              margin: 1.5rem 0;
              padding-left: 2rem;
            }

            .blog-content-view li {
              margin: 0.5rem 0;
              line-height: 1.8;
            }

            .blog-content-view ul {
              list-style-type: disc;
            }

            .blog-content-view ol {
              list-style-type: decimal;
            }

            .blog-content-view blockquote {
              border-left: 4px solid #3b82f6;
              padding-left: 1.5rem;
              margin: 1.5rem 0;
              color: #9ca3af;
              font-style: italic;
              background-color: #111827;
              padding: 1rem 1.5rem;
              border-radius: 0.5rem;
            }

            .blog-content-view pre {
              background-color: #1f2937;
              color: #10b981;
              border-radius: 0.5rem;
              padding: 1.5rem;
              margin: 1.5rem 0;
              overflow-x: auto;
              border: 1px solid #374151;
            }

            .blog-content-view code {
              background-color: #1f2937;
              color: #10b981;
              padding: 0.2rem 0.4rem;
              border-radius: 0.25rem;
              font-size: 0.875em;
              font-family: 'Courier New', monospace;
            }

            .blog-content-view pre code {
              background-color: transparent;
              padding: 0;
              color: inherit;
            }

            .blog-content-view a {
              color: #60a5fa;
              text-decoration: underline;
              transition: color 0.2s;
            }

            .blog-content-view a:hover {
              color: #93c5fd;
            }

            .blog-content-view img {
              max-width: 100%;
              height: auto;
              border-radius: 0.5rem;
              margin: 2rem auto;
              display: block;
            }

            .blog-content-view figure.ql-image-with-caption {
              margin: 2rem 0;
              text-align: center;
            }

            .blog-content-view figure.ql-image-with-caption img {
              display: block;
              margin: 0 auto;
              border-radius: 0.5rem;
              max-width: 100%;
              height: auto;
            }

            .blog-content-view figure.ql-image-with-caption .image-caption {
              text-align: center;
              font-size: 0.875rem;
              color: #9ca3af;
              margin-top: 0.75rem;
              font-style: italic;
              padding: 0.5rem;
            }

            .blog-content-view strong,
            .blog-content-view b {
              font-weight: bold;
              color: #ffffff;
            }

            .blog-content-view em,
            .blog-content-view i {
              font-style: italic;
            }

            .blog-content-view u {
              text-decoration: underline;
            }

            .blog-content-view s,
            .blog-content-view strike {
              text-decoration: line-through;
            }

            .blog-content-view hr {
              border: none;
              border-top: 1px solid #374151;
              margin: 2rem 0;
            }

            .blog-content-view table {
              width: 100%;
              border-collapse: collapse;
              margin: 1.5rem 0;
            }

            .blog-content-view th,
            .blog-content-view td {
              border: 1px solid #374151;
              padding: 0.75rem;
              text-align: left;
            }

            .blog-content-view th {
              background-color: #111827;
              font-weight: bold;
              color: #ffffff;
            }

            .blog-content-view tr:nth-child(even) {
              background-color: #111827;
            }
          `}</style>

          {/* Slug */}
          {blog.slug && (
            <div className="mt-8 pt-6 border-t border-gray-800">
              <p className="text-sm text-gray-500 mb-2">Slug:</p>
              <code className="text-sm bg-black border border-gray-700 text-gray-300 px-3 py-2 rounded">
                {blog.slug}
              </code>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


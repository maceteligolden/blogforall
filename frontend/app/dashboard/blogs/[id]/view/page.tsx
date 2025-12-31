"use client";

import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useBlog } from "@/lib/hooks/use-blog";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      <header className="bg-black/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard/blogs")}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-white">View Blog</h1>
            </div>
            <div className="flex items-center space-x-4">
              <Link href={`/dashboard/blogs/${id}`}>
                <Button className="bg-primary hover:bg-primary/90 text-white">Edit</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
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
          <div className="prose prose-invert max-w-none">
            {blog.content_type === "markdown" ? (
              <div
                className="text-gray-300 whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            ) : (
              <div
                className="text-gray-300"
                dangerouslySetInnerHTML={{ __html: blog.content }}
              />
            )}
          </div>

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


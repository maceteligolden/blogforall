"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useBlogs } from "@/lib/hooks/use-blog";
import { useDeleteBlog, usePublishBlog, useUnpublishBlog } from "@/lib/hooks/use-blog";
import { Button } from "@/components/ui/button";
import { BlogStatus } from "@/lib/types/blog";

export default function BlogsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<BlogStatus | "all">("all");
  const { data: blogs, isLoading } = useBlogs(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const deleteBlog = useDeleteBlog();
  const publishBlog = usePublishBlog();
  const unpublishBlog = useUnpublishBlog();

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this blog?")) {
      deleteBlog.mutate(id);
    }
  };

  const handlePublish = (id: string) => {
    publishBlog.mutate(id);
  };

  const handleUnpublish = (id: string) => {
    unpublishBlog.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading blogs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-white">My Blogs</h1>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => router.push("/dashboard/blogs/new")}
            >
              Create Blog
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex space-x-2">
          <Button
            className={
              statusFilter === "all"
                ? "bg-primary hover:bg-primary/90 text-white"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            }
            onClick={() => setStatusFilter("all")}
            size="sm"
          >
            All
          </Button>
          <Button
            className={
              statusFilter === "draft"
                ? "bg-primary hover:bg-primary/90 text-white"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            }
            onClick={() => setStatusFilter("draft")}
            size="sm"
          >
            Drafts
          </Button>
          <Button
            className={
              statusFilter === "published"
                ? "bg-primary hover:bg-primary/90 text-white"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            }
            onClick={() => setStatusFilter("published")}
            size="sm"
          >
            Published
          </Button>
          <Button
            className={
              statusFilter === "unpublished"
                ? "bg-primary hover:bg-primary/90 text-white"
                : "bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
            }
            onClick={() => setStatusFilter("unpublished")}
            size="sm"
          >
            Unpublished
          </Button>
        </div>

        {/* Blogs List */}
        {!blogs || blogs.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <p className="text-gray-400 mb-4">No blogs found.</p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => router.push("/dashboard/blogs/new")}
            >
              Create Your First Blog
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map((blog: any) => (
              <div
                key={blog._id}
                className="bg-gray-900 rounded-lg border border-gray-800 hover:border-gray-700 transition-colors"
              >
                {blog.featured_image && (
                  <div className="relative w-full h-48">
                    <Image
                      src={blog.featured_image}
                      alt={blog.title}
                      fill
                      className="object-cover rounded-t-lg"
                      unoptimized={blog.featured_image.includes("localhost")}
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="text-lg font-semibold text-white line-clamp-2">{blog.title}</h3>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded capitalize ${
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
                  {blog.excerpt && (
                    <p className="text-sm text-gray-400 mb-4 line-clamp-2">{blog.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{blog.views || 0} views</span>
                    <span>{blog.likes || 0} likes</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex-1"
                      size="sm"
                      onClick={() => router.push(`/dashboard/blogs/${blog._id}/view`)}
                    >
                      View
                    </Button>
                    <Button
                      className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex-1"
                      size="sm"
                      onClick={() => router.push(`/dashboard/blogs/${blog._id}`)}
                    >
                      Edit
                    </Button>
                    {blog.status === "draft" && (
                      <Button
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex-1"
                        size="sm"
                        onClick={() => handlePublish(blog._id)}
                      >
                        Publish
                      </Button>
                    )}
                    {blog.status === "published" && (
                      <Button
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700 flex-1"
                        size="sm"
                        onClick={() => handleUnpublish(blog._id)}
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      className="bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-800"
                      size="sm"
                      onClick={() => handleDelete(blog._id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}


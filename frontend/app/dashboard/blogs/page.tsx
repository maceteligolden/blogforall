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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-600">Loading blogs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard")}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">My Blogs</h1>
            </div>
            <Button onClick={() => router.push("/dashboard/blogs/new")}>Create Blog</Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters */}
        <div className="mb-6 flex space-x-2">
          <Button
            variant={statusFilter === "all" ? "default" : "outline"}
            onClick={() => setStatusFilter("all")}
            size="sm"
          >
            All
          </Button>
          <Button
            variant={statusFilter === "draft" ? "default" : "outline"}
            onClick={() => setStatusFilter("draft")}
            size="sm"
          >
            Drafts
          </Button>
          <Button
            variant={statusFilter === "published" ? "default" : "outline"}
            onClick={() => setStatusFilter("published")}
            size="sm"
          >
            Published
          </Button>
          <Button
            variant={statusFilter === "unpublished" ? "default" : "outline"}
            onClick={() => setStatusFilter("unpublished")}
            size="sm"
          >
            Unpublished
          </Button>
        </div>

        {/* Blogs List */}
        {!blogs || blogs.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 mb-4">No blogs found.</p>
            <Button onClick={() => router.push("/dashboard/blogs/new")}>Create Your First Blog</Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {blogs.map((blog: any) => (
              <div key={blog._id} className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow">
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
                    <h3 className="text-lg font-semibold text-gray-900 line-clamp-2">{blog.title}</h3>
                    <span
                      className={`px-2 py-1 text-xs rounded capitalize ${
                        blog.status === "published"
                          ? "bg-green-100 text-green-800"
                          : blog.status === "draft"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {blog.status}
                    </span>
                  </div>
                  {blog.excerpt && (
                    <p className="text-sm text-gray-600 mb-4 line-clamp-2">{blog.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-sm text-gray-500 mb-4">
                    <span>{blog.views || 0} views</span>
                    <span>{blog.likes || 0} likes</span>
                  </div>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/dashboard/blogs/${blog._id}`)}
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    {blog.status === "draft" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePublish(blog._id)}
                        className="flex-1"
                      >
                        Publish
                      </Button>
                    )}
                    {blog.status === "published" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnpublish(blog._id)}
                        className="flex-1"
                      >
                        Unpublish
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(blog._id)}
                      className="text-red-600 hover:text-red-700"
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


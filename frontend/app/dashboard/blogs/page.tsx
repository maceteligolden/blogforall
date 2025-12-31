"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useBlogs } from "@/lib/hooks/use-blog";
import { useDeleteBlog, usePublishBlog, useUnpublishBlog } from "@/lib/hooks/use-blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BlogStatus } from "@/lib/types/blog";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ConfirmModal } from "@/components/ui/modal";
import { Search, Grid3x3, Table2, Trash2 } from "lucide-react";

export default function BlogsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<BlogStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [blogToDelete, setBlogToDelete] = useState<string | null>(null);
  
  const { data: blogs, isLoading } = useBlogs(
    statusFilter !== "all" ? { status: statusFilter } : undefined
  );
  const deleteBlog = useDeleteBlog();
  const publishBlog = usePublishBlog();
  const unpublishBlog = useUnpublishBlog();

  // Filter blogs by search query
  const filteredBlogs = useMemo(() => {
    if (!blogs) return [];
    if (!searchQuery.trim()) return blogs;
    
    const query = searchQuery.toLowerCase();
    return blogs.filter((blog: any) =>
      blog.title.toLowerCase().includes(query)
    );
  }, [blogs, searchQuery]);

  const handleDeleteClick = (id: string) => {
    setBlogToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (blogToDelete) {
      deleteBlog.mutate(blogToDelete);
      setBlogToDelete(null);
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
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb items={[{ label: "Blogs" }]} />
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display text-white">My Blogs</h1>
          <Button
            className="bg-primary hover:bg-primary/90 text-white"
            onClick={() => router.push("/dashboard/blogs/new")}
          >
            Create Blog
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="mb-6 space-y-4">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search blogs by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-black border-gray-700 text-white"
              />
            </div>
            <div className="flex items-center space-x-2 border border-gray-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("cards")}
                className={`p-2 rounded transition-colors ${
                  viewMode === "cards"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded transition-colors ${
                  viewMode === "table"
                    ? "bg-primary text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                <Table2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status Filters */}
          <div className="flex space-x-2">
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
        </div>

        {/* Blogs List */}
        {!filteredBlogs || filteredBlogs.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <p className="text-gray-400 mb-4">
              {searchQuery ? "No blogs found matching your search." : "No blogs found."}
            </p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => router.push("/dashboard/blogs/new")}
            >
              Create Your First Blog
            </Button>
          </div>
        ) : viewMode === "cards" ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredBlogs.map((blog: any) => (
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
                      onClick={() => handleDeleteClick(blog._id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-gray-900 rounded-lg border border-gray-800 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800 border-b border-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Title</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Views</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Likes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Updated</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {filteredBlogs.map((blog: any) => (
                  <tr key={blog._id} className="hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        {blog.featured_image && (
                          <div className="relative w-12 h-12 flex-shrink-0">
                            <Image
                              src={blog.featured_image}
                              alt={blog.title}
                              fill
                              className="object-cover rounded"
                              unoptimized={blog.featured_image.includes("localhost")}
                            />
                          </div>
                        )}
                        <div>
                          <div className="text-sm font-medium text-white">{blog.title}</div>
                          {blog.excerpt && (
                            <div className="text-xs text-gray-400 line-clamp-1">{blog.excerpt}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 text-xs rounded capitalize ${
                          blog.status === "published"
                            ? "bg-green-900/30 text-green-400 border border-green-800"
                            : blog.status === "draft"
                              ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800"
                              : "bg-gray-800 text-gray-400 border border-gray-700"
                        }`}
                      >
                        {blog.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-300">{blog.views || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-300">{blog.likes || 0}</td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {blog.updated_at ? new Date(blog.updated_at).toLocaleDateString() : "-"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                          size="sm"
                          onClick={() => router.push(`/dashboard/blogs/${blog._id}/view`)}
                        >
                          View
                        </Button>
                        <Button
                          className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                          size="sm"
                          onClick={() => router.push(`/dashboard/blogs/${blog._id}`)}
                        >
                          Edit
                        </Button>
                        {blog.status === "draft" && (
                          <Button
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                            size="sm"
                            onClick={() => handlePublish(blog._id)}
                          >
                            Publish
                          </Button>
                        )}
                        {blog.status === "published" && (
                          <Button
                            className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                            size="sm"
                            onClick={() => handleUnpublish(blog._id)}
                          >
                            Unpublish
                          </Button>
                        )}
                        <Button
                          className="bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-800"
                          size="sm"
                          onClick={() => handleDeleteClick(blog._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={deleteModalOpen}
        onClose={() => {
          setDeleteModalOpen(false);
          setBlogToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Blog"
        message="Are you sure you want to delete this blog? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}

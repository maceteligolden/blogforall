"use client";

import { useAuth } from "@/lib/hooks/use-auth";
import { useBlogs } from "@/lib/hooks/use-blog";
import { useApiKeys } from "@/lib/hooks/use-api-key";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DashboardPage() {
  const { user, logout, isLoading: authLoading } = useAuth();
  const { data: blogs, isLoading: blogsLoading } = useBlogs();
  const { data: apiKeys, isLoading: keysLoading } = useApiKeys();
  const router = useRouter();

  const handleLogout = () => {
    logout();
  };

  const isLoading = authLoading || blogsLoading || keysLoading;
  const totalBlogs = blogs?.length || 0;
  const publishedBlogs = blogs?.filter((b: any) => b.status === "published").length || 0;
  const totalApiKeys = apiKeys?.length || 0;
  const recentBlogs = blogs?.slice(0, 5) || [];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - Netflix-inspired */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/dashboard" className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">BlogForAll</h1>
            </Link>
            <div className="flex items-center space-x-6">
              <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">
                Home
              </Link>
              <Link
                href="/dashboard/profile"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Profile
              </Link>
              <span className="text-sm text-gray-400">
                {user?.first_name} {user?.last_name}
              </span>
              <Button
                variant="outline"
                onClick={handleLogout}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
              >
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-4xl font-bold mb-2 tracking-tight">Welcome back, {user?.first_name}!</h2>
          <p className="text-gray-400 text-lg">Manage your blogs and API keys from here</p>
        </div>

        {/* Stats Cards - Netflix card style */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Plan</h3>
            <p className="text-3xl font-bold text-white capitalize mb-1">{user?.plan || "Free"}</p>
            <p className="text-xs text-gray-500">Current subscription</p>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">Total Blogs</h3>
            <p className="text-3xl font-bold text-white mb-1">{totalBlogs}</p>
            <p className="text-xs text-gray-500">{publishedBlogs} published</p>
          </div>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 hover:border-gray-700 transition-colors">
            <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wide">API Keys</h3>
            <p className="text-3xl font-bold text-white mb-1">{totalApiKeys}</p>
            <p className="text-xs text-gray-500">Active keys</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-12">
          <h3 className="text-xl font-semibold mb-4 text-white">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              className="w-full justify-start bg-primary hover:bg-primary/90 text-white h-12 text-base font-medium"
              onClick={() => router.push("/dashboard/blogs/new")}
            >
              Create Blog Post
            </Button>
            <Button
              className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 h-12 text-base font-medium"
              onClick={() => router.push("/dashboard/blogs")}
            >
              Manage Blogs
            </Button>
            <Button
              className="w-full justify-start bg-gray-800 hover:bg-gray-700 text-white border border-gray-700 h-12 text-base font-medium"
              onClick={() => router.push("/dashboard/api-keys")}
            >
              Manage API Keys
            </Button>
          </div>
        </div>

        {/* Recent Blogs */}
        {recentBlogs.length > 0 && (
          <div className="mb-12">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">Recent Blogs</h3>
              <Link
                href="/dashboard/blogs"
                className="text-sm text-primary hover:text-primary/80 transition-colors"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {recentBlogs.map((blog: any) => (
                <div
                  key={blog._id}
                  className="bg-gray-900 rounded-lg border border-gray-800 p-4 hover:border-gray-700 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dashboard/blogs/${blog._id}`)}
                >
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="text-base font-semibold text-white line-clamp-2 flex-1">{blog.title}</h4>
                    <span
                      className={`ml-2 px-2 py-1 text-xs rounded ${
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
                    <p className="text-sm text-gray-400 line-clamp-2 mb-3">{blog.excerpt}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <span>{blog.views || 0} views</span>
                    <span>{blog.likes || 0} likes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {recentBlogs.length === 0 && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <h3 className="text-xl font-semibold text-white mb-2">No blogs yet</h3>
            <p className="text-gray-400 mb-6">Start by creating your first blog post!</p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => router.push("/dashboard/blogs/new")}
            >
              Create Your First Blog
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

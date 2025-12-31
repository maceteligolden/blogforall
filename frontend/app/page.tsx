"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/lib/store/auth.store";

export default function Home() {
  const { isAuthenticated } = useAuthStore();

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">BlogForAll</h1>
            </Link>
            <div className="flex items-center space-x-6">
              {isAuthenticated ? (
                <>
                  <Link
                    href="/dashboard"
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Dashboard
                  </Link>
                </>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    Login
                  </Link>
                  <Link href="/auth/signup">
                    <Button className="bg-primary hover:bg-primary/90 text-white">Sign Up</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 tracking-tight">
            Manage Your Blogs
            <br />
            <span className="text-primary">Anywhere, Anytime</span>
          </h1>
          <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
            A powerful blog management platform with API access. Create, manage, and display your
            blogs with ease.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {!isAuthenticated && (
              <>
                <Link href="/auth/signup">
                  <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg">
                    Get Started Free
                  </Button>
                </Link>
                <Link href="/auth/login">
                  <Button
                    variant="outline"
                    className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white px-8 py-6 text-lg"
                  >
                    Sign In
                  </Button>
                </Link>
              </>
            )}
            {isAuthenticated && (
              <Link href="/dashboard">
                <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg">
                  Go to Dashboard
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Blog Management</h3>
              <p className="text-gray-400">
                Create, edit, and manage your blog posts with support for HTML and Markdown. Save
                drafts, publish, and unpublish with ease.
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">API Access</h3>
              <p className="text-gray-400">
                Generate API keys to access your blogs programmatically. Perfect for custom
                frontends and integrations.
              </p>
            </div>
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <h3 className="text-xl font-semibold mb-3 text-primary">Guest Engagement</h3>
              <p className="text-gray-400">
                Allow guests to comment and like your posts. Build a community around your content.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* API Documentation Section */}
      <section className="py-24 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">API Documentation</h2>

          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8 mb-8">
            <h3 className="text-xl font-semibold mb-4 text-primary">Getting Started</h3>
            <p className="text-gray-400 mb-4">
              To use the BlogForAll API, you need to generate an API key from your dashboard. Once
              you have your API key, include it in your requests using the following headers:
            </p>
            <div className="bg-black rounded-lg p-4 border border-gray-800">
              <code className="text-sm text-gray-300">
                <div>x-access-key-id: your_access_key_id</div>
                <div>x-secret-key: your_secret_key</div>
              </code>
            </div>
          </div>

          {/* API Endpoints */}
          <div className="space-y-6">
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs font-mono rounded border border-green-800">
                  GET
                </span>
                <code className="text-primary font-mono">/api/v1/public/blogs</code>
              </div>
              <p className="text-gray-400 mb-4">Get all published blogs with pagination and search.</p>
              <div className="bg-black rounded-lg p-4 border border-gray-800 mb-4">
                <div className="text-xs text-gray-500 mb-2">Query Parameters:</div>
                <code className="text-sm text-gray-300">
                  <div>page (optional): Page number (default: 1)</div>
                  <div>limit (optional): Items per page (default: 10, max: 100)</div>
                  <div>search (optional): Search in title, excerpt, content</div>
                </code>
              </div>
              <div className="bg-black rounded-lg p-4 border border-gray-800">
                <div className="text-xs text-gray-500 mb-2">Example:</div>
                <code className="text-sm text-gray-300">
                  curl -H &quot;x-access-key-id: your_key&quot; \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H &quot;x-secret-key: your_secret&quot; \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;http://localhost:5005/api/v1/public/blogs?page=1&limit=20&quot;
                </code>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs font-mono rounded border border-green-800">
                  GET
                </span>
                <code className="text-primary font-mono">/api/v1/public/blogs/:id</code>
              </div>
              <p className="text-gray-400 mb-4">Get a single published blog by ID.</p>
              <div className="bg-black rounded-lg p-4 border border-gray-800">
                <div className="text-xs text-gray-500 mb-2">Example:</div>
                <code className="text-sm text-gray-300">
                  curl -H &quot;x-access-key-id: your_key&quot; \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H &quot;x-secret-key: your_secret&quot; \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;http://localhost:5005/api/v1/public/blogs/BLOG_ID&quot;
                </code>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs font-mono rounded border border-green-800">
                  GET
                </span>
                <code className="text-primary font-mono">/api/v1/public/blogs/slug/:slug</code>
              </div>
              <p className="text-gray-400 mb-4">Get a single published blog by slug.</p>
              <div className="bg-black rounded-lg p-4 border border-gray-800">
                <div className="text-xs text-gray-500 mb-2">Example:</div>
                <code className="text-sm text-gray-300">
                  curl -H &quot;x-access-key-id: your_key&quot; \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;-H &quot;x-secret-key: your_secret&quot; \<br />
                  &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&quot;http://localhost:5005/api/v1/public/blogs/slug/my-blog-post&quot;
                </code>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-blue-900/30 text-blue-400 text-xs font-mono rounded border border-blue-800">
                  POST
                </span>
                <code className="text-primary font-mono">/api/v1/comments</code>
              </div>
              <p className="text-gray-400 mb-4">Create a comment on a published blog (no authentication required).</p>
              <div className="bg-black rounded-lg p-4 border border-gray-800 mb-4">
                <div className="text-xs text-gray-500 mb-2">Request Body:</div>
                <code className="text-sm text-gray-300">
                  {`{
  "blog": "BLOG_ID",
  "author_name": "John Doe",
  "author_email": "john@example.com",
  "content": "Great post!",
  "parent_comment": "COMMENT_ID" // optional, for replies
}`}
                </code>
              </div>
            </div>

            <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="px-3 py-1 bg-green-900/30 text-green-400 text-xs font-mono rounded border border-green-800">
                  GET
                </span>
                <code className="text-primary font-mono">/api/v1/comments/blog/:blogId</code>
              </div>
              <p className="text-gray-400 mb-4">Get comments for a blog (no authentication required).</p>
              <div className="bg-black rounded-lg p-4 border border-gray-800">
                <div className="text-xs text-gray-500 mb-2">Query Parameters:</div>
                <code className="text-sm text-gray-300">
                  <div>page (optional): Page number (default: 1)</div>
                  <div>limit (optional): Items per page (default: 10, max: 100)</div>
                </code>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Response Format Section */}
      <section className="py-24 px-6 lg:px-8 bg-gray-900/50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Response Format</h2>
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-8">
            <p className="text-gray-400 mb-4">All API responses follow this format:</p>
            <div className="bg-black rounded-lg p-4 border border-gray-800">
              <code className="text-sm text-gray-300">
                {`{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
    "data": [...],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 50,
      "totalPages": 5
    }
  }
}`}
              </code>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-12 px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-gray-400 text-sm">© 2024 BlogForAll. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

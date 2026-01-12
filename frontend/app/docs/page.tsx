"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { LandingHeader } from "@/components/layout/landing-header";
import { LandingFooter } from "@/components/layout/landing-footer";

export default function DocsPage() {
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const CodeBlock = ({ code, language = "bash", id }: { code: string; language?: string; id?: string }) => (
    <div className="relative group">
      <pre className="bg-black rounded-lg p-4 border border-gray-800 overflow-x-auto">
        <code className={`text-sm text-gray-300 font-mono`}>{code}</code>
      </pre>
      {id && (
        <button
          onClick={() => copyToClipboard(code, id)}
          className="absolute top-2 right-2 px-3 py-1 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded border border-gray-700 transition-colors"
        >
          {copiedCode === id ? "Copied!" : "Copy"}
        </button>
      )}
    </div>
  );

  const EndpointCard = ({
    method,
    path,
    description,
    requiresAuth = false,
    children,
  }: {
    method: string;
    path: string;
    description: string;
    requiresAuth?: boolean;
    children?: React.ReactNode;
  }) => {
    const methodColors: Record<string, string> = {
      GET: "bg-green-900/30 text-green-400 border-green-800",
      POST: "bg-blue-900/30 text-blue-400 border-blue-800",
      PUT: "bg-yellow-900/30 text-yellow-400 border-yellow-800",
      DELETE: "bg-red-900/30 text-red-400 border-red-800",
    };

    return (
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 hover:border-primary/30 transition-colors">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <span className={`px-3 py-1 ${methodColors[method] || methodColors.GET} text-xs font-mono rounded border`}>
            {method}
          </span>
          <code className="text-primary font-mono text-sm md:text-base">{path}</code>
          {requiresAuth && (
            <span className="px-2 py-1 bg-orange-900/30 text-orange-400 text-xs rounded border border-orange-800">
              Requires API Key
            </span>
          )}
        </div>
        <p className="text-gray-400 mb-4">{description}</p>
        {children}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <LandingHeader />

      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            API <span className="text-primary">Documentation</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-3xl mx-auto">
            Complete guide to integrating BlogForAll with your applications. Build custom frontends, 
            mobile apps, or connect with third-party services.
          </p>
        </div>

        {/* Table of Contents */}
        <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-12">
          <h2 className="text-xl font-semibold mb-4 text-primary">Table of Contents</h2>
          <ul className="space-y-2 text-gray-300">
            <li><a href="#api-keys" className="hover:text-primary transition-colors">1. API Key Setup</a></li>
            <li><a href="#authentication" className="hover:text-primary transition-colors">2. Authentication</a></li>
            <li><a href="#blogs" className="hover:text-primary transition-colors">3. Blog Endpoints</a></li>
            <li><a href="#comments" className="hover:text-primary transition-colors">4. Comment Endpoints</a></li>
            <li><a href="#frontend-examples" className="hover:text-primary transition-colors">5. Frontend Examples</a></li>
          </ul>
        </div>

        {/* API Key Setup */}
        <section id="api-keys" className="mb-20">
          <h2 className="text-4xl font-bold mb-8">1. API Key Setup</h2>
          
          <div className="space-y-6 mb-8">
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-2xl font-semibold mb-4 text-primary">Creating API Keys</h3>
              <p className="text-gray-400 mb-6">
                To use the BlogForAll API, you need to create API credentials. Follow these steps:
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Sign up or Log in</h4>
                    <p className="text-gray-400">Create an account or log in to your existing BlogForAll account.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Navigate to API Keys</h4>
                    <p className="text-gray-400">Go to your Dashboard → API Keys section.</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Create New API Key</h4>
                    <p className="text-gray-400 mb-4">Click "Create New API Key" and provide a name for your key (e.g., "Production", "Development").</p>
                    <CodeBlock
                      code={`POST /api/v1/api-keys
Content-Type: application/json
Authorization: Bearer YOUR_JWT_TOKEN

{
  "name": "My API Key"
}`}
                      id="create-api-key"
                    />
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center font-bold text-primary">
                    4
                  </div>
                  <div>
                    <h4 className="font-semibold mb-2">Save Your Credentials</h4>
                    <p className="text-gray-400 mb-4">
                      The API will return your <code className="bg-gray-800 px-2 py-1 rounded text-primary">accessKeyId</code> and <code className="bg-gray-800 px-2 py-1 rounded text-primary">secretKey</code>. 
                      <strong className="text-white"> Save the secretKey immediately - it will only be shown once!</strong>
                    </p>
                    <CodeBlock
                      code={`{
  "success": true,
  "message": "API key created successfully",
  "data": {
    "id": "ak_1234567890",
    "name": "My API Key",
    "accessKeyId": "ak_1234567890",
    "secretKey": "sk_abcdefghijklmnopqrstuvwxyz1234567890",
    "createdAt": "2024-01-15T10:30:00.000Z",
    "isActive": true
  }
}`}
                      id="api-key-response"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Authentication */}
        <section id="authentication" className="mb-20">
          <h2 className="text-4xl font-bold mb-8">2. Authentication</h2>
          
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
            <h3 className="text-2xl font-semibold mb-4 text-primary">Using API Keys</h3>
            <p className="text-gray-400 mb-4">
              Include your API credentials in the request headers for all protected endpoints:
            </p>
            <CodeBlock
              code={`x-access-key-id: your_access_key_id
x-secret-key: your_secret_key`}
              id="auth-headers"
            />
          </div>

          <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <svg className="w-6 h-6 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <h4 className="font-semibold text-yellow-400 mb-2">Security Best Practices</h4>
                <ul className="text-gray-300 space-y-1 text-sm">
                  <li>• Never expose your secret key in client-side code or public repositories</li>
                  <li>• Use environment variables to store API credentials</li>
                  <li>• Rotate your API keys regularly</li>
                  <li>• Delete unused API keys</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Blog Endpoints */}
        <section id="blogs" className="mb-20">
          <h2 className="text-4xl font-bold mb-8">3. Blog Endpoints</h2>

          <div className="space-y-6">
            {/* Get All Blogs */}
            <EndpointCard
              method="GET"
              path="/api/v1/public/blogs"
              description="Get all published blogs with pagination, search, and filtering."
              requiresAuth={true}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-gray-300">Query Parameters</h4>
                  <div className="bg-black rounded-lg p-4 border border-gray-800">
                    <table className="w-full text-sm text-gray-300">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left py-2 px-3">Parameter</th>
                          <th className="text-left py-2 px-3">Type</th>
                          <th className="text-left py-2 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-3"><code className="text-primary">page</code></td>
                          <td className="py-2 px-3">number</td>
                          <td className="py-2 px-3">Page number (default: 1)</td>
                        </tr>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-3"><code className="text-primary">limit</code></td>
                          <td className="py-2 px-3">number</td>
                          <td className="py-2 px-3">Items per page (default: 10, max: 100)</td>
                        </tr>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-3"><code className="text-primary">search</code></td>
                          <td className="py-2 px-3">string</td>
                          <td className="py-2 px-3">Search in title, excerpt, and content</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3"><code className="text-primary">category</code></td>
                          <td className="py-2 px-3">string</td>
                          <td className="py-2 px-3">Filter by category ID</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <CodeBlock
                  code={`curl -X GET "https://api.blogforall.com/api/v1/public/blogs?page=1&limit=20&search=javascript" \\
  -H "x-access-key-id: your_access_key_id" \\
  -H "x-secret-key: your_secret_key"`}
                  id="get-all-blogs"
                />
                <div>
                  <h4 className="font-semibold mb-2 text-gray-300">Response</h4>
                  <CodeBlock
                    code={`{
  "success": true,
  "message": "Published blogs retrieved successfully",
  "data": {
    "data": [
      {
        "_id": "blog_id_123",
        "title": "Getting Started with JavaScript",
        "slug": "getting-started-with-javascript",
        "excerpt": "Learn the basics of JavaScript...",
        "content": "<p>Full blog content...</p>",
        "featured_image": "https://example.com/image.jpg",
        "author": {
          "name": "John Doe",
          "email": "john@example.com"
        },
        "category": "category_id_123",
        "likes": 42,
        "views": 1250,
        "published_at": "2024-01-15T10:30:00.000Z",
        "created_at": "2024-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  }
}`}
                    id="get-all-blogs-response"
                  />
                </div>
              </div>
            </EndpointCard>

            {/* Get Blog by ID */}
            <EndpointCard
              method="GET"
              path="/api/v1/public/blogs/:id"
              description="Get a single published blog by its ID."
              requiresAuth={true}
            >
              <CodeBlock
                code={`curl -X GET "https://api.blogforall.com/api/v1/public/blogs/blog_id_123" \\
  -H "x-access-key-id: your_access_key_id" \\
  -H "x-secret-key: your_secret_key"`}
                id="get-blog-by-id"
              />
            </EndpointCard>

            {/* Get Blog by Slug */}
            <EndpointCard
              method="GET"
              path="/api/v1/public/blogs/slug/:slug"
              description="Get a single published blog by its URL-friendly slug."
              requiresAuth={true}
            >
              <CodeBlock
                code={`curl -X GET "https://api.blogforall.com/api/v1/public/blogs/slug/getting-started-with-javascript" \\
  -H "x-access-key-id: your_access_key_id" \\
  -H "x-secret-key: your_secret_key"`}
                id="get-blog-by-slug"
              />
            </EndpointCard>

            {/* Get Categories */}
            <EndpointCard
              method="GET"
              path="/api/v1/public/blogs/categories"
              description="Get all categories available for your blogs."
              requiresAuth={true}
            >
              <CodeBlock
                code={`curl -X GET "https://api.blogforall.com/api/v1/public/blogs/categories" \\
  -H "x-access-key-id: your_access_key_id" \\
  -H "x-secret-key: your_secret_key"`}
                id="get-categories"
              />
            </EndpointCard>

            {/* Get Blogs by Category */}
            <EndpointCard
              method="GET"
              path="/api/v1/public/blogs/categories/:categoryId"
              description="Get all published blogs in a specific category."
              requiresAuth={true}
            >
              <div className="space-y-4">
                <CodeBlock
                  code={`curl -X GET "https://api.blogforall.com/api/v1/public/blogs/categories/category_id_123?page=1&limit=10" \\
  -H "x-access-key-id: your_access_key_id" \\
  -H "x-secret-key: your_secret_key"`}
                  id="get-blogs-by-category"
                />
                <p className="text-sm text-gray-500">Supports the same query parameters as Get All Blogs (page, limit, search).</p>
              </div>
            </EndpointCard>

            {/* Like Blog */}
            <EndpointCard
              method="POST"
              path="/api/v1/blogs/:id/like"
              description="Toggle like on a blog post. No authentication required - uses IP address for guests."
              requiresAuth={false}
            >
              <CodeBlock
                code={`curl -X POST "https://api.blogforall.com/api/v1/blogs/blog_id_123/like" \\
  -H "Content-Type: application/json"`}
                id="like-blog"
              />
              <div className="mt-4">
                <h4 className="font-semibold mb-2 text-gray-300">Response</h4>
                <CodeBlock
                  code={`{
  "success": true,
  "message": "Like toggled successfully",
  "data": {
    "liked": true,
    "likes": 43
  }
}`}
                  id="like-blog-response"
                />
              </div>
            </EndpointCard>
          </div>
        </section>

        {/* Comment Endpoints */}
        <section id="comments" className="mb-20">
          <h2 className="text-4xl font-bold mb-8">4. Comment Endpoints</h2>

          <div className="space-y-6">
            {/* Create Comment */}
            <EndpointCard
              method="POST"
              path="/api/v1/comments"
              description="Create a comment on a published blog. No authentication required for guests."
              requiresAuth={false}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-gray-300">Request Body</h4>
                  <CodeBlock
                    code={`{
  "blog": "blog_id_123",
  "author_name": "John Doe",
  "author_email": "john@example.com",  // Optional
  "content": "Great post! This was very helpful.",
  "parent_comment": "comment_id_456"  // Optional, for replies
}`}
                    id="create-comment-body"
                  />
                </div>
                <CodeBlock
                  code={`curl -X POST "https://api.blogforall.com/api/v1/comments" \\
  -H "Content-Type: application/json" \\
  -d '{
    "blog": "blog_id_123",
    "author_name": "John Doe",
    "author_email": "john@example.com",
    "content": "Great post!"
  }'`}
                  id="create-comment"
                />
              </div>
            </EndpointCard>

            {/* Get Comments */}
            <EndpointCard
              method="GET"
              path="/api/v1/comments/blog/:blogId"
              description="Get all comments for a specific blog with pagination."
              requiresAuth={false}
            >
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2 text-gray-300">Query Parameters</h4>
                  <div className="bg-black rounded-lg p-4 border border-gray-800">
                    <table className="w-full text-sm text-gray-300">
                      <thead>
                        <tr className="border-b border-gray-800">
                          <th className="text-left py-2 px-3">Parameter</th>
                          <th className="text-left py-2 px-3">Type</th>
                          <th className="text-left py-2 px-3">Description</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-b border-gray-800">
                          <td className="py-2 px-3"><code className="text-primary">page</code></td>
                          <td className="py-2 px-3">number</td>
                          <td className="py-2 px-3">Page number (default: 1)</td>
                        </tr>
                        <tr>
                          <td className="py-2 px-3"><code className="text-primary">limit</code></td>
                          <td className="py-2 px-3">number</td>
                          <td className="py-2 px-3">Items per page (default: 10, max: 100)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                <CodeBlock
                  code={`curl -X GET "https://api.blogforall.com/api/v1/comments/blog/blog_id_123?page=1&limit=20"`}
                  id="get-comments"
                />
                <div>
                  <h4 className="font-semibold mb-2 text-gray-300">Response</h4>
                  <CodeBlock
                    code={`{
  "success": true,
  "message": "Comments retrieved successfully",
  "data": {
    "data": [
      {
        "_id": "comment_id_123",
        "blog": "blog_id_123",
        "author_name": "John Doe",
        "author_email": "john@example.com",
        "content": "Great post!",
        "likes": 5,
        "parent_comment": null,
        "replies": [],
        "created_at": "2024-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}`}
                    id="get-comments-response"
                  />
                </div>
              </div>
            </EndpointCard>

            {/* Get Comment by ID */}
            <EndpointCard
              method="GET"
              path="/api/v1/comments/:id"
              description="Get a single comment by its ID."
              requiresAuth={false}
            >
              <CodeBlock
                code={`curl -X GET "https://api.blogforall.com/api/v1/comments/comment_id_123"`}
                id="get-comment-by-id"
              />
            </EndpointCard>

            {/* Get Comment Replies */}
            <EndpointCard
              method="GET"
              path="/api/v1/comments/:commentId/replies"
              description="Get all replies to a specific comment."
              requiresAuth={false}
            >
              <CodeBlock
                code={`curl -X GET "https://api.blogforall.com/api/v1/comments/comment_id_123/replies"`}
                id="get-comment-replies"
              />
            </EndpointCard>

            {/* Like Comment */}
            <EndpointCard
              method="POST"
              path="/api/v1/comments/:id/like"
              description="Toggle like on a comment. No authentication required."
              requiresAuth={false}
            >
              <CodeBlock
                code={`curl -X POST "https://api.blogforall.com/api/v1/comments/comment_id_123/like" \\
  -H "Content-Type: application/json"`}
                id="like-comment"
              />
            </EndpointCard>
          </div>
        </section>

        {/* Frontend Examples */}
        <section id="frontend-examples" className="mb-20">
          <h2 className="text-4xl font-bold mb-8">5. Frontend Integration Examples</h2>

          <div className="space-y-8">
            {/* JavaScript/TypeScript Example */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-2xl font-semibold mb-4 text-primary">JavaScript/TypeScript Example</h3>
              <CodeBlock
                code={`// API Configuration
const API_BASE_URL = 'https://api.blogforall.com/api/v1';
const ACCESS_KEY_ID = 'your_access_key_id';
const SECRET_KEY = 'your_secret_key';

// Fetch all blogs
async function fetchBlogs(page = 1, limit = 10, search = '') {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
    ...(search && { search })
  });

  const response = await fetch(\`\${API_BASE_URL}/public/blogs?\${params}\`, {
    method: 'GET',
    headers: {
      'x-access-key-id': ACCESS_KEY_ID,
      'x-secret-key': SECRET_KEY
    }
  });

  const data = await response.json();
  return data.data;
}

// Fetch single blog by slug
async function fetchBlogBySlug(slug) {
  const response = await fetch(\`\${API_BASE_URL}/public/blogs/slug/\${slug}\`, {
    method: 'GET',
    headers: {
      'x-access-key-id': ACCESS_KEY_ID,
      'x-secret-key': SECRET_KEY
    }
  });

  const data = await response.json();
  return data.data;
}

// Like a blog post
async function likeBlog(blogId) {
  const response = await fetch(\`\${API_BASE_URL}/blogs/\${blogId}/like\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();
  return data.data;
}

// Create a comment
async function createComment(blogId, commentData) {
  const response = await fetch(\`\${API_BASE_URL}/comments\`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      blog: blogId,
      author_name: commentData.name,
      author_email: commentData.email,
      content: commentData.content,
      parent_comment: commentData.parentComment // Optional
    })
  });

  const data = await response.json();
  return data.data;
}

// Get comments for a blog
async function fetchComments(blogId, page = 1, limit = 20) {
  const params = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString()
  });

  const response = await fetch(\`\${API_BASE_URL}/comments/blog/\${blogId}?\${params}\`);
  const data = await response.json();
  return data.data;
}`}
                id="js-example"
              />
            </div>

            {/* React Component Example */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-2xl font-semibold mb-4 text-primary">React Component Example</h3>
              <CodeBlock
                code={`import { useState, useEffect } from 'react';

function BlogList() {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchBlogs();
  }, [page, search]);

  const fetchBlogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '10',
        ...(search && { search })
      });

      const response = await fetch(
        \`\${API_BASE_URL}/public/blogs?\${params}\`,
        {
          headers: {
            'x-access-key-id': ACCESS_KEY_ID,
            'x-secret-key': SECRET_KEY
          }
        }
      );

      const data = await response.json();
      setBlogs(data.data.data);
    } catch (error) {
      console.error('Error fetching blogs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLike = async (blogId) => {
    try {
      await fetch(\`\${API_BASE_URL}/blogs/\${blogId}/like\`, {
        method: 'POST'
      });
      fetchBlogs(); // Refresh to get updated like count
    } catch (error) {
      console.error('Error liking blog:', error);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <input
        type="text"
        placeholder="Search blogs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      
      <div className="blog-grid">
        {blogs.map((blog) => (
          <article key={blog._id} className="blog-card">
            <img src={blog.featured_image} alt={blog.title} />
            <h2>{blog.title}</h2>
            <p>{blog.excerpt}</p>
            <div className="blog-actions">
              <button onClick={() => handleLike(blog._id)}>
                ❤️ {blog.likes}
              </button>
              <span>👁️ {blog.views}</span>
            </div>
          </article>
        ))}
      </div>

      <div className="pagination">
        <button onClick={() => setPage(p => Math.max(1, p - 1))}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={() => setPage(p => p + 1)}>
          Next
        </button>
      </div>
    </div>
  );
}`}
                id="react-example"
              />
            </div>

            {/* Comment Component Example */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-2xl font-semibold mb-4 text-primary">Comment Component Example</h3>
              <CodeBlock
                code={`function CommentSection({ blogId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState({ name: '', email: '', content: '' });

  useEffect(() => {
    fetchComments();
  }, [blogId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(\`\${API_BASE_URL}/comments/blog/\${blogId}?page=1&limit=50\`);
      const data = await response.json();
      setComments(data.data.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await fetch(\`\${API_BASE_URL}/comments\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blog: blogId,
          author_name: newComment.name,
          author_email: newComment.email,
          content: newComment.content
        })
      });
      setNewComment({ name: '', email: '', content: '' });
      fetchComments(); // Refresh comments
    } catch (error) {
      console.error('Error creating comment:', error);
    }
  };

  const handleLike = async (commentId) => {
    try {
      await fetch(\`\${API_BASE_URL}/comments/\${commentId}/like\`, {
        method: 'POST'
      });
      fetchComments(); // Refresh to get updated like count
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  return (
    <div className="comments-section">
      <h3>Comments ({comments.length})</h3>
      
      <form onSubmit={handleSubmit} className="comment-form">
        <input
          type="text"
          placeholder="Your name"
          value={newComment.name}
          onChange={(e) => setNewComment({...newComment, name: e.target.value})}
          required
        />
        <input
          type="email"
          placeholder="Your email (optional)"
          value={newComment.email}
          onChange={(e) => setNewComment({...newComment, email: e.target.value})}
        />
        <textarea
          placeholder="Write a comment..."
          value={newComment.content}
          onChange={(e) => setNewComment({...newComment, content: e.target.value})}
          required
        />
        <button type="submit">Post Comment</button>
      </form>

      <div className="comments-list">
        {comments.map((comment) => (
          <div key={comment._id} className="comment">
            <div className="comment-header">
              <strong>{comment.author_name}</strong>
              <span>{new Date(comment.created_at).toLocaleDateString()}</span>
            </div>
            <p>{comment.content}</p>
            <div className="comment-actions">
              <button onClick={() => handleLike(comment._id)}>
                ❤️ {comment.likes}
              </button>
            </div>
            
            {/* Render replies if any */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="replies">
                {comment.replies.map((reply) => (
                  <div key={reply._id} className="reply">
                    <strong>{reply.author_name}</strong>
                    <p>{reply.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}`}
                id="comment-component"
              />
            </div>

            {/* CSS Styling Example */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
              <h3 className="text-2xl font-semibold mb-4 text-primary">CSS Styling Example</h3>
              <CodeBlock
                code={`.blog-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 2rem;
  margin: 2rem 0;
}

.blog-card {
  background: #1a1a1a;
  border: 1px solid #333;
  border-radius: 12px;
  padding: 1.5rem;
  transition: transform 0.2s, border-color 0.2s;
}

.blog-card:hover {
  transform: translateY(-4px);
  border-color: #3b82f6;
}

.blog-card img {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.blog-card h2 {
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
  color: #fff;
}

.blog-card p {
  color: #999;
  margin-bottom: 1rem;
}

.blog-actions {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.comments-section {
  margin-top: 3rem;
  padding: 2rem;
  background: #1a1a1a;
  border-radius: 12px;
}

.comment-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.comment-form input,
.comment-form textarea {
  padding: 0.75rem;
  background: #0a0a0a;
  border: 1px solid #333;
  border-radius: 8px;
  color: #fff;
}

.comment {
  padding: 1rem;
  margin-bottom: 1rem;
  background: #0a0a0a;
  border-radius: 8px;
  border-left: 3px solid #3b82f6;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.5rem;
}

.replies {
  margin-left: 2rem;
  margin-top: 1rem;
  padding-left: 1rem;
  border-left: 2px solid #333;
}`}
                id="css-example"
              />
            </div>
          </div>
        </section>

        {/* Error Handling */}
        <section className="mb-20">
          <h2 className="text-4xl font-bold mb-8">Error Handling</h2>
          
          <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
            <p className="text-gray-400 mb-4">
              All API responses follow a consistent format. Errors are returned with appropriate HTTP status codes:
            </p>
            
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2 text-gray-300">Success Response</h4>
                <CodeBlock
                  code={`{
  "success": true,
  "message": "Operation successful",
  "data": { ... }
}`}
                  id="success-response"
                />
              </div>

              <div>
                <h4 className="font-semibold mb-2 text-gray-300">Error Response</h4>
                <CodeBlock
                  code={`{
  "success": false,
  "message": "Error message",
  "error": {
    "code": "ERROR_CODE",
    "details": "Additional error details"
  }
}`}
                  id="error-response"
                />
              </div>

              <div className="bg-black rounded-lg p-4 border border-gray-800">
                <h4 className="font-semibold mb-3 text-gray-300">Common HTTP Status Codes</h4>
                <ul className="space-y-2 text-sm text-gray-300">
                  <li><code className="text-green-400">200</code> - Success</li>
                  <li><code className="text-blue-400">201</code> - Created</li>
                  <li><code className="text-yellow-400">400</code> - Bad Request</li>
                  <li><code className="text-orange-400">401</code> - Unauthorized (Invalid API key)</li>
                  <li><code className="text-red-400">404</code> - Not Found</li>
                  <li><code className="text-red-400">500</code> - Internal Server Error</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <div className="bg-gradient-to-r from-primary/20 to-blue-500/20 rounded-2xl border border-primary/30 p-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
            Create your API keys and start building amazing integrations with BlogForAll.
          </p>
          <Link href="/auth/signup">
            <Button className="bg-primary hover:bg-primary/90 text-white px-8 py-6 text-lg">
              Sign Up Free
            </Button>
          </Link>
        </div>
      </div>

      <LandingFooter />
    </div>
  );
}

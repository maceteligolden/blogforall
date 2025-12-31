"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewBlogPage() {
  const router = useRouter();
  const createBlog = useCreateBlog();
  const uploadImage = useUploadImage();
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_type: "html" as "html" | "markdown",
    excerpt: "",
    featured_image: "",
    status: "draft" as "draft" | "published" | "unpublished",
  });
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.content) {
      setError("Title and content are required");
      return;
    }

    try {
      createBlog.mutate(formData);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create blog";
      setError(errorMessage);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadImage.mutateAsync(file);
      setFormData({ ...formData, featured_image: response.data.data.url });
    } catch (err) {
      setError("Failed to upload image");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push("/dashboard/blogs")}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-900">Create New Blog</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-6">
          {error && <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>}

          <div>
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1"
              required
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="content_type">Content Type</Label>
            <select
              id="content_type"
              value={formData.content_type}
              onChange={(e) =>
                setFormData({ ...formData, content_type: e.target.value as "html" | "markdown" })
              }
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>

          <div>
            <Label htmlFor="content">Content *</Label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="mt-1 flex min-h-[300px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <Label htmlFor="excerpt">Excerpt</Label>
            <textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="mt-1 flex min-h-[80px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500">{formData.excerpt.length}/500</p>
          </div>

          <div>
            <Label htmlFor="featured_image">Featured Image</Label>
            <Input
              id="featured_image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="mt-1"
            />
            {formData.featured_image && (
              <div className="mt-2 relative w-32 h-32">
                <Image
                  src={formData.featured_image}
                  alt="Featured"
                  fill
                  className="object-cover rounded"
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "draft" | "published" | "unpublished",
                })
              }
              className="mt-1 flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          <div className="flex space-x-4">
            <Button type="submit" disabled={createBlog.isPending}>
              {createBlog.isPending ? "Creating..." : "Create Blog"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard/blogs")}>
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}


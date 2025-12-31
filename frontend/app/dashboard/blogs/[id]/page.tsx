"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useBlog, useUpdateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { useCategories } from "@/lib/hooks/use-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function EditBlogPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const { data: blog, isLoading } = useBlog(id);
  const updateBlog = useUpdateBlog();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_type: "html" as "html" | "markdown",
    excerpt: "",
    featured_image: "",
    category: "",
    status: "draft" as "draft" | "published" | "unpublished",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (blog) {
      setFormData({
        title: blog.title || "",
        content: blog.content || "",
        content_type: blog.content_type || "html",
        excerpt: blog.excerpt || "",
        featured_image: blog.featured_image || "",
        category: (blog as any).category || "",
        status: blog.status || "draft",
      });
    }
  }, [blog]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.title || !formData.content) {
      setError("Title and content are required");
      return;
    }

    try {
      updateBlog.mutate({ id, data: formData });
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to update blog";
      setError(errorMessage);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await uploadImage.mutateAsync(file);
      const imageUrl = response.data.data.url;
      setFormData({ ...formData, featured_image: imageUrl });
      setError(""); // Clear any previous errors
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to upload image";
      setError(errorMessage);
      console.error("Image upload error:", err);
    }
  };

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
              <h1 className="text-2xl font-bold text-white">Edit Blog</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-6">
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="title" className="text-gray-300">
              Title *
            </Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="mt-1 bg-black border-gray-700 text-white"
              required
              maxLength={200}
            />
          </div>

          <div>
            <Label htmlFor="content_type" className="text-gray-300">
              Content Type
            </Label>
            <select
              id="content_type"
              value={formData.content_type}
              onChange={(e) =>
                setFormData({ ...formData, content_type: e.target.value as "html" | "markdown" })
              }
              className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
            >
              <option value="html">HTML</option>
              <option value="markdown">Markdown</option>
            </select>
          </div>

          <div>
            <Label htmlFor="content" className="text-gray-300">
              Content *
            </Label>
            <textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              className="mt-1 flex min-h-[300px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
              required
            />
          </div>

          <div>
            <Label htmlFor="excerpt" className="text-gray-300">
              Excerpt
            </Label>
            <textarea
              id="excerpt"
              value={formData.excerpt}
              onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
              className="mt-1 flex min-h-[80px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
              maxLength={500}
            />
            <p className="mt-1 text-xs text-gray-500">{formData.excerpt.length}/500</p>
          </div>

          <div>
            <Label htmlFor="featured_image" className="text-gray-300">
              Featured Image
            </Label>
            <Input
              id="featured_image"
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="mt-1 bg-black border-gray-700 text-white"
            />
            {formData.featured_image && (
              <div className="mt-2 relative w-32 h-32">
                <Image
                  src={formData.featured_image}
                  alt="Featured"
                  fill
                  className="object-cover rounded"
                  unoptimized={formData.featured_image.includes("localhost")}
                />
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="category" className="text-gray-300">
              Category
            </Label>
            <select
              id="category"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
            >
              <option value="">No Category</option>
              {categories &&
                categories
                  .filter((cat: any) => cat.is_active)
                  .map((cat: any) => (
                    <option key={cat._id} value={cat._id}>
                      {cat.name}
                    </option>
                  ))}
            </select>
          </div>

          <div>
            <Label htmlFor="status" className="text-gray-300">
              Status
            </Label>
            <select
              id="status"
              value={formData.status}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  status: e.target.value as "draft" | "published" | "unpublished",
                })
              }
              className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
            >
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="unpublished">Unpublished</option>
            </select>
          </div>

          <div className="flex space-x-4">
            <Button
              type="submit"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={updateBlog.isPending}
            >
              {updateBlog.isPending ? "Saving..." : "Save Changes"}
            </Button>
            <Button
              type="button"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              onClick={() => router.push("/dashboard/blogs")}
            >
              Cancel
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}


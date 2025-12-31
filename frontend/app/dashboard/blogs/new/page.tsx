"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCreateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { useCategories } from "@/lib/hooks/use-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/editor/rich-text-editor";

export default function NewBlogPage() {
  const router = useRouter();
  const createBlog = useCreateBlog();
  const uploadImage = useUploadImage();
  const { data: categories } = useCategories({ tree: false });
  const [formData, setFormData] = useState({
    title: "",
    content: "",
    content_type: "html" as "html" | "markdown", // Rich text editor always outputs HTML
    excerpt: "",
    featured_image: "",
    category: "",
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
      const submitData = {
        ...formData,
        category: formData.category || undefined,
      };
      createBlog.mutate(submitData);
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

  // Handle image uploads from the rich text editor
  useEffect(() => {
    const handleEditorImageUpload = async (event: Event) => {
      const customEvent = event as CustomEvent;
      const { file, resolve, reject } = customEvent.detail;

      try {
        const response = await uploadImage.mutateAsync(file);
        const imageUrl = response.data.data.url;
        resolve(imageUrl);
      } catch (err: unknown) {
        const errorMessage =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          "Failed to upload image";
        reject(new Error(errorMessage));
        console.error("Editor image upload error:", err);
      }
    };

    window.addEventListener("upload-image" as any, handleEditorImageUpload);

    return () => {
      window.removeEventListener("upload-image" as any, handleEditorImageUpload);
    };
  }, [uploadImage]);

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
              <h1 className="text-2xl font-bold text-white">Create New Blog</h1>
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
            <Label htmlFor="content" className="text-gray-300">
              Content *
            </Label>
            <div className="mt-1">
              <RichTextEditor
                value={formData.content}
                onChange={(value) => setFormData({ ...formData, content: value })}
                placeholder="Start writing your blog post..."
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Use the toolbar to format your text, add headers, lists, images, and more.
            </p>
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
              disabled={createBlog.isPending}
            >
              {createBlog.isPending ? "Creating..." : "Create Blog"}
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


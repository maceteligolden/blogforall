"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Image from "next/image";
import { useBlog, useUpdateBlog, useUploadImage } from "@/lib/hooks/use-blog";
import { useCategories } from "@/lib/hooks/use-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichTextEditor } from "@/components/editor/rich-text-editor";
import { Breadcrumb } from "@/components/layout/breadcrumb";

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
    content_type: "html" as "html" | "markdown", // Rich text editor always outputs HTML
    excerpt: "",
    featured_image: "",
    category: "",
    status: "draft" as "draft" | "published" | "unpublished",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (blog) {
      // Handle category - it might be an object with _id or a string
      let categoryId = "";
      if ((blog as any).category) {
        if (typeof (blog as any).category === "string") {
          categoryId = (blog as any).category;
        } else if ((blog as any).category._id) {
          categoryId = (blog as any).category._id;
        } else if ((blog as any).category.toString) {
          categoryId = (blog as any).category.toString();
        }
      }

      setFormData({
        title: blog.title || "",
        content: blog.content || "",
        content_type: blog.content_type || "html",
        excerpt: blog.excerpt || "",
        featured_image: blog.featured_image || "",
        category: categoryId,
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
    <div className="h-screen bg-black text-white flex flex-col overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex-shrink-0">
        <Breadcrumb
          items={[
            { label: "Blogs", href: "/dashboard/blogs" },
            { label: blog?.title || "Edit Blog" },
          ]}
        />
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-display text-white">Edit Blog</h1>
          <div className="flex items-center space-x-4">
            <Button
              type="button"
              className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
              onClick={() => router.push("/dashboard/blogs")}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="blog-form"
              className="bg-primary hover:bg-primary/90 text-white"
              disabled={updateBlog.isPending}
            >
              {updateBlog.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
          <form id="blog-form" onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
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

              <div className="flex-1 min-h-0">
                <Label htmlFor="content" className="text-gray-300 mb-2 block">
                  Content *
                </Label>
                <div className="h-[calc(100vh-500px)] min-h-[600px]">
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
            </div>

            <div className="lg:col-span-1 space-y-6">
              <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 space-y-6">
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
                  <Label htmlFor="excerpt" className="text-gray-300">
                    Excerpt
                  </Label>
                  <textarea
                    id="excerpt"
                    value={formData.excerpt}
                    onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })}
                    className="mt-1 flex min-h-[100px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
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
                    <div className="mt-2 relative w-full aspect-video">
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
              </div>
            </div>
          </div>
          </form>
        </div>
      </main>
    </div>
  );
}


"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCategories, useCreateCategory, useDeleteCategory, useUpdateCategory } from "@/lib/hooks/use-category";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CategoriesPage() {
  const router = useRouter();
  const { data: categories, isLoading } = useCategories({ tree: true });
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    parent: "",
    color: "#3b82f6",
  });
  const [error, setError] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      await createCategory.mutateAsync({
        name: formData.name.trim(),
        description: formData.description || undefined,
        parent: formData.parent || undefined,
        color: formData.color || undefined,
      });
      setFormData({ name: "", description: "", parent: "", color: "#3b82f6" });
      setShowCreateForm(false);
    } catch (err: unknown) {
      const errorMessage =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
        "Failed to create category";
      setError(errorMessage);
    }
  };

  const handleUpdate = async (id: string, data: { name?: string; description?: string; parent?: string; color?: string }) => {
    try {
      await updateCategory.mutateAsync({ id, data });
      setEditingId(null);
    } catch (err) {
      setError("Failed to update category");
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this category? Blogs assigned to it will lose their category.")) {
      try {
        await deleteCategory.mutateAsync(id);
      } catch (err) {
        setError("Failed to delete category");
      }
    }
  };

  const renderCategoryTree = (items: any[], level = 0): React.ReactElement[] => {
    return items.map((category) => (
      <div key={category._id} className="ml-4">
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-4 mb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-2">
                {category.color && (
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: category.color }}
                  />
                )}
                <h3 className="text-lg font-semibold text-white">{category.name}</h3>
                {category.is_active ? (
                  <span className="px-2 py-1 text-xs rounded bg-green-900/30 text-green-400 border border-green-800">
                    Active
                  </span>
                ) : (
                  <span className="px-2 py-1 text-xs rounded bg-gray-800 text-gray-400 border border-gray-700">
                    Inactive
                  </span>
                )}
              </div>
              {category.description && (
                <p className="text-sm text-gray-400 mb-2">{category.description}</p>
              )}
              <p className="text-xs text-gray-500">Slug: {category.slug}</p>
            </div>
            <div className="flex space-x-2">
              <Button
                className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                size="sm"
                onClick={() => {
                  setEditingId(category._id);
                  setFormData({
                    name: category.name,
                    description: category.description || "",
                    parent: category.parent || "",
                    color: category.color || "#3b82f6",
                  });
                }}
              >
                Edit
              </Button>
              <Button
                className="bg-gray-800 hover:bg-red-900/30 text-red-400 border border-gray-700 hover:border-red-800"
                size="sm"
                onClick={() => handleDelete(category._id)}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
        {category.children && category.children.length > 0 && (
          <div className="ml-4">{renderCategoryTree(category.children, level + 1)}</div>
        )}
      </div>
    ));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading categories...</p>
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
                onClick={() => router.push("/dashboard")}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-white">Categories</h1>
            </div>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => setShowCreateForm(true)}
            >
              Create Category
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 lg:px-8 py-8">
        {/* Create/Edit Form */}
        {(showCreateForm || editingId) && (
          <div className="mb-6 bg-gray-900 rounded-lg border border-gray-800 p-6">
            <h3 className="text-lg font-semibold text-white mb-4">
              {editingId ? "Edit Category" : "Create New Category"}
            </h3>
            {error && (
              <div className="mb-4 rounded-md bg-red-900/20 border border-red-800 p-3 text-sm text-red-400">
                {error}
              </div>
            )}
            <form onSubmit={editingId ? (e) => { e.preventDefault(); handleUpdate(editingId, formData); } : handleCreate} className="space-y-4">
              <div>
                <Label htmlFor="name" className="text-gray-300">
                  Name *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1 bg-black border-gray-700 text-white"
                  required
                  maxLength={100}
                />
              </div>
              <div>
                <Label htmlFor="description" className="text-gray-300">
                  Description
                </Label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 flex min-h-[80px] w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                  maxLength={500}
                />
              </div>
              <div>
                <Label htmlFor="parent" className="text-gray-300">
                  Parent Category
                </Label>
                <select
                  id="parent"
                  value={formData.parent}
                  onChange={(e) => setFormData({ ...formData, parent: e.target.value })}
                  className="mt-1 flex h-10 w-full rounded-md border border-gray-700 bg-black text-white px-3 py-2 text-sm"
                >
                  <option value="">None (Root Category)</option>
                  {categories &&
                    categories
                      .filter((cat: any) => !editingId || cat._id !== editingId)
                      .map((cat: any) => (
                        <option key={cat._id} value={cat._id}>
                          {cat.name}
                        </option>
                      ))}
                </select>
              </div>
              <div>
                <Label htmlFor="color" className="text-gray-300">
                  Color
                </Label>
                <div className="flex items-center space-x-2 mt-1">
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="h-10 w-20 bg-black border-gray-700"
                  />
                  <Input
                    type="text"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                    className="flex-1 bg-black border-gray-700 text-white font-mono"
                    placeholder="#3b82f6"
                  />
                </div>
              </div>
              <div className="flex space-x-4">
                <Button
                  type="submit"
                  className="bg-primary hover:bg-primary/90 text-white"
                  disabled={createCategory.isPending || updateCategory.isPending}
                >
                  {editingId
                    ? updateCategory.isPending
                      ? "Saving..."
                      : "Save Changes"
                    : createCategory.isPending
                      ? "Creating..."
                      : "Create Category"}
                </Button>
                <Button
                  type="button"
                  className="bg-gray-800 hover:bg-gray-700 text-gray-300 border border-gray-700"
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingId(null);
                    setFormData({ name: "", description: "", parent: "", color: "#3b82f6" });
                    setError("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Categories List */}
        {!categories || categories.length === 0 ? (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
            <p className="text-gray-400 mb-4">No categories found.</p>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => setShowCreateForm(true)}
            >
              Create Your First Category
            </Button>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Category Tree</h2>
            {renderCategoryTree(categories)}
          </div>
        )}
      </main>
    </div>
  );
}


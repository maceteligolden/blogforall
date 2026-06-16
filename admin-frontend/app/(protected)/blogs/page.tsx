"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useAdminBlogs } from "@/lib/hooks/use-admin-blogs";

export default function AdminBlogsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminBlogs({ page: 1, limit: 50, search });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Blogs</h1>
          <p className="text-sm text-gray-400">All blogs with their creators.</p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search blogs..."
          className="max-w-xs bg-gray-800 border-gray-700 text-white"
        />
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 text-gray-300">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Creator</th>
              <th className="text-left p-3">Site</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((blog) => (
              <tr key={blog.id} className="border-t border-gray-800 hover:bg-gray-900/60">
                <td className="p-3">
                  <div className="font-medium text-white">{blog.title}</div>
                  <div className="text-xs text-gray-400">{blog.slug}</div>
                </td>
                <td className="p-3 text-gray-200">{blog.status}</td>
                <td className="p-3">
                  {blog.author ? (
                    <>
                      <div className="text-white">{blog.author.name}</div>
                      <div className="text-xs text-gray-400">{blog.author.email}</div>
                    </>
                  ) : (
                    <span className="text-gray-500">Unknown</span>
                  )}
                </td>
                <td className="p-3 text-gray-400">{blog.site_id}</td>
              </tr>
            ))}
            {!isLoading && (data?.data?.length ?? 0) === 0 && (
              <tr>
                <td className="p-4 text-gray-400" colSpan={4}>
                  No blogs found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

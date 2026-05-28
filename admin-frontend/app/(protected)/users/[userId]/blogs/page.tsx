"use client";

import { useParams } from "next/navigation";
import { useAdminUserBlogs } from "@/lib/hooks/use-admin-user-blogs";

export default function AdminUserBlogsPage() {
  const params = useParams<{ userId: string }>();
  const userId = params?.userId ?? "";
  const { data, isLoading } = useAdminUserBlogs(userId, { page: 1, limit: 50 });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">User blogs</h1>
        <p className="text-sm text-gray-400">Blogs created by user: {userId}</p>
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 text-gray-300">
            <tr>
              <th className="text-left p-3">Title</th>
              <th className="text-left p-3">Status</th>
              <th className="text-left p-3">Created</th>
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
                <td className="p-3 text-gray-400">
                  {blog.created_at ? new Date(blog.created_at).toLocaleString() : "-"}
                </td>
              </tr>
            ))}
            {!isLoading && (data?.data?.length ?? 0) === 0 && (
              <tr>
                <td className="p-4 text-gray-400" colSpan={3}>
                  No blogs found for this user.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

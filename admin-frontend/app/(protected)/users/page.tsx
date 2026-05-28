"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { useAdminUsers } from "@/lib/hooks/use-admin-users";

export default function AdminUsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, isLoading } = useAdminUsers({ page: 1, limit: 50, search });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Users</h1>
          <p className="text-sm text-gray-400">Click a user row to view their blogs.</p>
        </div>
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="max-w-xs bg-gray-800 border-gray-700 text-white"
        />
      </div>

      <div className="rounded-lg border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900/80 text-gray-300">
            <tr>
              <th className="text-left p-3">User</th>
              <th className="text-left p-3">Blogs</th>
              <th className="text-left p-3">Categories</th>
              <th className="text-left p-3">Token usage</th>
            </tr>
          </thead>
          <tbody>
            {(data?.data ?? []).map((user) => (
              <tr
                key={user.id}
                className="border-t border-gray-800 hover:bg-gray-900/60 cursor-pointer"
                onClick={() => router.push(`/users/${user.id}/blogs`)}
              >
                <td className="p-3">
                  <div className="font-medium text-white">{`${user.first_name} ${user.last_name}`}</div>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </td>
                <td className="p-3 text-gray-200">{user.blogs_created}</td>
                <td className="p-3 text-gray-200">{user.categories_count}</td>
                <td className="p-3 text-gray-200">{user.token_usage.toLocaleString()}</td>
              </tr>
            ))}
            {!isLoading && (data?.data?.length ?? 0) === 0 && (
              <tr>
                <td className="p-4 text-gray-400" colSpan={4}>
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

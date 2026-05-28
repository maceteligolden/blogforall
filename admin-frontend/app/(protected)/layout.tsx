"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AdminNavbar } from "@/components/layout/admin-navbar";
import { ToastProvider } from "@/components/ui/toast";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <ToastProvider>
        <div className="min-h-screen bg-black text-white">
          <AdminNavbar />
          <main className="max-w-7xl mx-auto px-6 lg:px-8 py-8">{children}</main>
        </div>
      </ToastProvider>
    </ProtectedRoute>
  );
}

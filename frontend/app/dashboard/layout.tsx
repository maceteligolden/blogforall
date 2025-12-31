"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/layout/navbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <Navbar />
      <div className="min-h-screen bg-black text-white">
        {children}
      </div>
    </ProtectedRoute>
  );
}


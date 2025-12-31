"use client";

import { ProtectedRoute } from "@/components/protected-route";
import { Navbar } from "@/components/layout/navbar";
import { NotificationProvider } from "@/components/notifications/notification-provider";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <NotificationProvider>
        <Navbar />
        <div className="min-h-screen bg-black text-white">
          {children}
        </div>
      </NotificationProvider>
    </ProtectedRoute>
  );
}


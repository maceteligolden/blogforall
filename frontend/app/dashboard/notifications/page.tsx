"use client";

import { useRouter } from "next/navigation";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { PageLoading } from "@/components/ui/page-loading";
import { Button } from "@/components/ui/button";
import { NotificationService } from "@/lib/api/services/notification.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useNotifications } from "@/components/notifications/notification-provider";
import { formatDistanceToNow } from "date-fns";
import { Bell, Heart, MessageSquare, Mail, Shield, CheckCheck } from "lucide-react";
import type { NotificationItem } from "@/lib/api/types/notification.types";

function getIconForType(type: string) {
  switch (type) {
    case "like":
    case "like_on_post":
      return <Heart className="w-5 h-5" />;
    case "comment":
    case "comment_on_post":
      return <MessageSquare className="w-5 h-5" />;
    case "site_invitation":
    case "invitation_accepted":
    case "invitation_rejected":
      return <Mail className="w-5 h-5" />;
    default:
      return <Shield className="w-5 h-5" />;
  }
}

function getIconBgClass(type: string): string {
  switch (type) {
    case "like":
    case "like_on_post":
      return "bg-red-900/30 text-red-400";
    case "comment":
    case "comment_on_post":
      return "bg-blue-900/30 text-blue-400";
    case "site_invitation":
    case "invitation_accepted":
    case "invitation_rejected":
      return "bg-amber-900/30 text-amber-400";
    default:
      return "bg-gray-700 text-gray-400";
  }
}

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { refetch: refetchProvider } = useNotifications();

  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteQuery({
    queryKey: [...QUERY_KEYS.NOTIFICATIONS, "list"],
    queryFn: ({ pageParam = 1 }) =>
      NotificationService.list({ page: pageParam, limit: PAGE_SIZE }),
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    initialPageParam: 1,
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: () => NotificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT });
      refetchProvider();
    },
  });

  const notifications = Array.isArray(data?.pages)
    ? data.pages.flatMap((p) => (Array.isArray(p?.data) ? p.data : []))
    : [];
  const total = data?.pages[0]?.pagination?.total ?? 0;

  const handleItemClick = (notification: NotificationItem) => {
    if (!notification.read_at) {
      NotificationService.markAsRead(notification._id).then(() => {
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS });
        queryClient.invalidateQueries({ queryKey: QUERY_KEYS.NOTIFICATIONS_UNREAD_COUNT });
      });
    }
    const payload = notification.payload as { blogId?: string; blog_id?: string } | undefined;
    const blogId = payload?.blogId ?? payload?.blog_id;
    if (blogId) {
      router.push(`/dashboard/blogs/${blogId}/view`);
    }
  };

  if (isLoading) {
    return (
      <PageLoading
        breadcrumbItems={[{ label: "Dashboard" }, { label: "Notifications" }]}
        message="Loading notifications..."
      />
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-3xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Notifications" },
          ]}
        />

        <main className="py-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-display mb-2 tracking-tight">
                Notifications
              </h1>
              <p className="text-gray-400">
                {total > 0
                  ? `${total} notification${total !== 1 ? "s" : ""}`
                  : "Your notifications appear here"}
              </p>
            </div>
            {total > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending}
                className="border-gray-700 text-gray-300 hover:bg-gray-800 shrink-0"
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all as read
              </Button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="bg-gray-900 rounded-lg border border-gray-800 p-12 text-center">
              <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                No notifications yet
              </h3>
              <p className="text-gray-400">
                You&apos;re all caught up. When you get notifications, they&apos;ll appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((notification) => {
                const isUnread = !notification.read_at;
                return (
                  <div
                    key={notification._id}
                    role="button"
                    tabIndex={0}
                    className={`rounded-lg border p-4 transition-colors cursor-pointer hover:bg-gray-800/50 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-inset ${
                      isUnread
                        ? "bg-gray-800/30 border-gray-700"
                        : "bg-gray-900 border-gray-800"
                    }`}
                    onClick={() => handleItemClick(notification)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleItemClick(notification);
                      }
                    }}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${getIconBgClass(
                          notification.type
                        )}`}
                      >
                        {getIconForType(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">
                          {notification.title ?? notification.type}
                        </p>
                        {notification.body && (
                          <p className="text-sm text-gray-400 mt-0.5 line-clamp-2">
                            {notification.body}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-2">
                          {formatDistanceToNow(new Date(notification.created_at), {
                            addSuffix: true,
                          })}
                        </p>
                      </div>
                      {isUnread && (
                        <div
                          className="w-2.5 h-2.5 bg-primary rounded-full flex-shrink-0 mt-2"
                          aria-hidden
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {hasNextPage && (
            <div className="mt-8 flex justify-center">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                {isFetchingNextPage ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

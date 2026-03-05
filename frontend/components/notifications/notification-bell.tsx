"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, X, Heart, MessageSquare, Mail, Shield } from "lucide-react";
import { useNotifications } from "./notification-provider";
import { formatDistanceToNow } from "date-fns";
import type { NotificationItem } from "@/lib/api/types/notification.types";

function getIconForType(type: string) {
  switch (type) {
    case "like":
    case "like_on_post":
      return <Heart className="w-4 h-4" />;
    case "comment":
    case "comment_on_post":
      return <MessageSquare className="w-4 h-4" />;
    case "site_invitation":
    case "invitation_accepted":
    case "invitation_rejected":
      return <Mail className="w-4 h-4" />;
    default:
      return <Shield className="w-4 h-4" />;
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

export function NotificationBell() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const {
    notifications,
    unreadCount,
    isLoadingList,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const closeDropdown = useCallback(() => setIsOpen(false), []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        closeDropdown();
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, closeDropdown]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") closeDropdown();
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, closeDropdown]);

  const handleNotificationClick = (notification: NotificationItem) => {
    if (!notification.read_at) {
      markAsRead(notification._id);
    }
    const payload = notification.payload as { blogId?: string; blog_id?: string } | undefined;
    const blogId = payload?.blogId ?? payload?.blog_id;
    if (blogId) {
      router.push(`/dashboard/blogs/${blogId}/view`);
    }
    closeDropdown();
  };

  const badgeLabel =
    unreadCount > 0
      ? unreadCount > 9
        ? "9+"
        : String(unreadCount)
      : "0";
  const ariaLabel =
    unreadCount > 0
      ? `Notifications (${unreadCount} unread)`
      : "Notifications";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-black"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls="notification-dropdown"
      >
        <Bell className="w-5 h-5" aria-hidden />
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[1.25rem] h-5 px-1 flex items-center justify-center text-[10px] font-semibold bg-primary text-black rounded-full"
            aria-hidden
          >
            {badgeLabel}
          </span>
        )}
      </button>

      {isOpen && (
        <div
          id="notification-dropdown"
          role="dialog"
          aria-label="Notification list"
          className="absolute right-0 mt-2 w-80 bg-gray-900 border border-gray-800 rounded-lg shadow-lg z-[10001] max-h-96 overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    markAllAsRead();
                  }}
                  className="text-xs text-primary hover:text-primary/80"
                >
                  Mark all read
                </button>
              )}
              <button
                type="button"
                onClick={closeDropdown}
                className="text-gray-400 hover:text-white p-1"
                aria-label="Close notifications"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {isLoadingList ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">Loading...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-400">No notifications yet</p>
                <p className="text-xs text-gray-500 mt-1">You&apos;re all caught up</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-800">
                {notifications.map((notification) => {
                  const isUnread = !notification.read_at;
                  return (
                    <div
                      key={notification._id}
                      role="button"
                      tabIndex={0}
                      className={`p-4 hover:bg-gray-800 transition-colors cursor-pointer focus:outline-none focus:ring-inset focus:ring-1 focus:ring-primary ${
                        isUnread ? "bg-gray-800/50" : ""
                      }`}
                      onClick={() => handleNotificationClick(notification)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleNotificationClick(notification);
                        }
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${getIconBgClass(
                            notification.type
                          )}`}
                        >
                          {getIconForType(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white font-medium">
                            {notification.title ?? notification.type}
                          </p>
                          {notification.body && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                              {notification.body}
                            </p>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), {
                              addSuffix: true,
                            })}
                          </p>
                        </div>
                        {isUnread && (
                          <div
                            className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-2"
                            aria-hidden
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-2 border-t border-gray-800">
            <Link
              href="/dashboard/notifications"
              onClick={closeDropdown}
              className="block text-center text-sm text-primary hover:text-primary/80 py-2"
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

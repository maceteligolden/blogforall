"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAllScheduledPosts } from "@/lib/hooks/use-scheduled-post";
import { ScheduledPost } from "@/lib/api/services/campaign.service";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addMonths, subMonths } from "date-fns";
import Link from "next/link";

export default function CalendarViewPage() {
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: scheduledPosts = [], isLoading } = useAllScheduledPosts();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);

  const daysInMonth = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  });

  const postsByDate = useMemo(() => {
    const map = new Map<string, ScheduledPost[]>();
    scheduledPosts.forEach((post: ScheduledPost) => {
      const postDate = new Date(post.scheduled_at);
      const dateKey = format(postDate, "yyyy-MM-dd");
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(post);
    });
    return map;
  }, [scheduledPosts]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "published":
        return "bg-green-500";
      case "pending":
      case "scheduled":
        return "bg-yellow-500";
      case "failed":
        return "bg-red-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-400";
    }
  };

  const selectedDatePosts = selectedDate
    ? postsByDate.get(format(selectedDate, "yyyy-MM-dd")) || []
    : [];

  const navigateMonth = (direction: "prev" | "next") => {
    setCurrentDate((prev) => (direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)));
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-4"></div>
          <p className="text-gray-400">Loading calendar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6">
        <Breadcrumb
          items={[
            { label: "Scheduled Posts", href: "/dashboard/scheduled-posts" },
            { label: "Calendar" },
          ]}
        />

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-display text-white">Calendar View</h1>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={() => router.push("/dashboard/scheduled-posts")}
            >
              <List className="w-4 h-4 mr-2" />
              List View
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-white"
              onClick={() => router.push("/dashboard/campaigns")}
            >
              Schedule Post
            </Button>
          </div>
        </div>

        {/* Calendar Header */}
        <div className="bg-gray-900 rounded-lg border border-gray-800 p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => navigateMonth("prev")}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <h2 className="text-xl font-semibold text-white">
                {format(currentDate, "MMMM yyyy")}
              </h2>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => navigateMonth("next")}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 ml-4"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </Button>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-2">
            {/* Weekday Headers */}
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-sm font-medium text-gray-400 py-2"
              >
                {day}
              </div>
            ))}

            {/* Calendar Days */}
            {daysInMonth.map((day, idx) => {
              const dateKey = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDate.get(dateKey) || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <div
                  key={idx}
                  className={`min-h-[100px] border border-gray-800 rounded-md p-2 cursor-pointer transition-colors ${
                    !isCurrentMonth ? "opacity-30" : ""
                  } ${
                    isSelected
                      ? "bg-primary/20 border-primary"
                      : "hover:bg-gray-800"
                  } ${isToday ? "ring-2 ring-primary/50" : ""}`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-medium ${
                        isToday
                          ? "bg-primary text-white rounded-full w-6 h-6 flex items-center justify-center"
                          : isSelected
                          ? "text-primary"
                          : "text-gray-300"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-xs text-gray-400">
                        {dayPosts.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 3).map((post) => (
                      <div
                        key={post._id}
                        className={`text-xs px-1 py-0.5 rounded truncate ${getStatusColor(
                          post.status
                        )} text-white`}
                        title={post.title}
                      >
                        {post.title}
                      </div>
                    ))}
                    {dayPosts.length > 3 && (
                      <div className="text-xs text-gray-400">
                        +{dayPosts.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Posts */}
        {selectedDate && (
          <div className="bg-gray-900 rounded-lg border border-gray-800 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">
                Posts scheduled for {format(selectedDate, "MMMM d, yyyy")}
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="text-gray-400 hover:text-white"
                onClick={() => setSelectedDate(null)}
              >
                Close
              </Button>
            </div>
            {selectedDatePosts.length === 0 ? (
              <p className="text-gray-400">No posts scheduled for this date.</p>
            ) : (
              <div className="space-y-3">
                {selectedDatePosts.map((post) => (
                  <div
                    key={post._id}
                    className="bg-gray-800 rounded-lg border border-gray-700 p-4 hover:border-gray-600 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className={`px-2 py-1 text-xs rounded capitalize border ${getStatusColor(
                              post.status
                            )} text-white`}
                          >
                            {post.status}
                          </span>
                          <span className="text-sm text-gray-400">
                            {format(new Date(post.scheduled_at), "h:mm a")}
                          </span>
                        </div>
                        <h4 className="text-white font-medium mb-1">{post.title}</h4>
                        {post.campaign_id && (
                          <Link
                            href={`/dashboard/campaigns/${post.campaign_id}`}
                            className="text-xs text-primary hover:text-primary/80"
                          >
                            View Campaign →
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-gray-900 rounded-lg border border-gray-800 p-4">
          <h4 className="text-sm font-semibold text-white mb-3">Status Legend</h4>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500"></div>
              <span className="text-sm text-gray-300">Published</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-yellow-500"></div>
              <span className="text-sm text-gray-300">Pending/Scheduled</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500"></div>
              <span className="text-sm text-gray-300">Failed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-gray-500"></div>
              <span className="text-sm text-gray-300">Cancelled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

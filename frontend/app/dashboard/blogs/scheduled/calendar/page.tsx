"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ScheduledPostsCalendar } from "@/components/scheduled/scheduled-posts-calendar";

const SCHEDULED_BASE = "/dashboard/blogs/scheduled";

export default function BlogScheduledCalendarPage() {
  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb
        items={[
          { label: "Contents", href: "/dashboard/blogs" },
          { label: "Scheduled", href: SCHEDULED_BASE },
          { label: "Calendar" },
        ]}
      />
      <ScheduledPostsCalendar />
    </div>
  );
}

"use client";

import { Breadcrumb } from "@/components/layout/breadcrumb";
import { ScheduledPostsCalendar } from "@/components/scheduled/scheduled-posts-calendar";

export default function CalendarPage() {
  return (
    <div className="p-4 lg:p-6">
      <Breadcrumb items={[{ label: "Calendar" }]} />
      <ScheduledPostsCalendar showListViewButton={true} listViewHref="/dashboard/blogs/scheduled" />
    </div>
  );
}

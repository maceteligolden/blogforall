import { Calendar, FileText, FolderOpen, LayoutDashboard, ShieldAlert, Megaphone, Compass } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/blogs", label: "Contents", icon: FileText },
  { href: "/dashboard/library", label: "Library", icon: FolderOpen },
  { href: "/dashboard/strategy", label: "Strategy", icon: Compass },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/approvals", label: "Approvals", icon: ShieldAlert },
];

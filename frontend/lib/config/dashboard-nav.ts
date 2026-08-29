import { Calendar, FileText, LayoutDashboard, ShieldAlert, Megaphone, Compass, Plug } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface DashboardNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/posts", label: "Posts", icon: FileText },
  { href: "/dashboard/strategy", label: "Content Strategy", icon: Compass },
  { href: "/dashboard/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/approvals", label: "Approvals", icon: ShieldAlert },
  { href: "/dashboard/integrations", label: "Integrations", icon: Plug },
];

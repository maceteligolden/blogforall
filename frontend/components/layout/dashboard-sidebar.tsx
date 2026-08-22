"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DASHBOARD_NAV_ITEMS } from "@/lib/config/dashboard-nav";
import { SiteSwitcher } from "@/components/sites/site-switcher";
import { useOrchestrator } from "@/components/orchestrator/orchestrator-provider";
import { SidebarTooltip } from "@/components/ui/sidebar-tooltip";

interface DashboardSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function DashboardSidebar({
  mobileOpen = false,
  onMobileClose,
  collapsed = false,
  onToggleCollapse,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { setThreadId, clearLiveArtifacts, setActiveDraftBlogId } = useOrchestrator();

  const isActiveNav = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <>
      <div className={cn("border-b border-gray-800 py-4", collapsed ? "px-2" : "px-4")}>
        <SiteSwitcher collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <ul className={cn("space-y-0.5", collapsed ? "px-1" : "px-2")}>
          {DASHBOARD_NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const link = (
              <Link
                href={href}
                onClick={() => {
                  if (href === "/dashboard") {
                    clearLiveArtifacts();
                    setThreadId(null);
                    setActiveDraftBlogId(null);
                  }
                  onMobileClose?.();
                }}
                aria-label={label}
                className={cn(
                  "flex items-center rounded-md text-sm font-medium transition-colors",
                  collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2",
                  isActiveNav(href)
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-gray-400 hover:bg-gray-900 hover:text-white border-l-2 border-transparent"
                )}
              >
                <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {!collapsed && label}
              </Link>
            );

            return <li key={href}>{collapsed ? <SidebarTooltip label={label}>{link}</SidebarTooltip> : link}</li>;
          })}
        </ul>
      </nav>

      {onToggleCollapse && (
        <div className="hidden md:flex border-t border-gray-800 p-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            className={cn(
              "flex w-full items-center rounded-md py-2 text-gray-400 hover:bg-gray-900 hover:text-white transition-colors",
              collapsed ? "justify-center px-2" : "gap-3 px-3"
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4 shrink-0" aria-hidden="true" />
            ) : (
              <>
                <PanelLeftClose className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span className="text-sm">Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </>
  );

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close sidebar"
          className="fixed inset-0 z-40 bg-black/60 md:hidden"
          onClick={onMobileClose}
        />
      )}

      <aside
        className={cn(
          "fixed md:static inset-y-0 left-0 z-50 md:z-auto",
          "shrink-0 flex flex-col bg-black border-r border-gray-800",
          "transform transition-[width,transform] duration-200 ease-out",
          "top-16 md:top-0 h-[calc(100vh-4rem)] md:h-auto md:min-h-[calc(100vh-4rem)]",
          collapsed ? "w-[4.5rem]" : "w-64 lg:w-72",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-gray-800">
          <span className="text-sm font-semibold">Menu</span>
          <button
            type="button"
            onClick={onMobileClose}
            aria-label="Close menu"
            className="p-1 text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}

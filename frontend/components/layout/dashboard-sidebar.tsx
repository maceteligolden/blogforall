"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Plus, X, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DASHBOARD_NAV_ITEMS } from "@/lib/config/dashboard-nav";
import { SiteSwitcher } from "@/components/sites/site-switcher";
import { OrchestratorService } from "@/lib/api/services/orchestrator.service";
import { QUERY_KEYS } from "@/lib/api/config";
import { useAuthStore } from "@/lib/store/auth.store";
import { formatThreadTimestamp } from "@/lib/utils/format-thread-timestamp";
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
  const router = useRouter();
  const { currentSiteId } = useAuthStore();
  const { threadId, setThreadId, clearLiveArtifacts } = useOrchestrator();

  const threadsQuery = useQuery({
    queryKey: currentSiteId
      ? [...QUERY_KEYS.ORCHESTRATOR_THREADS(currentSiteId), "recent", 5]
      : ["orchestrator", "threads", "none"],
    queryFn: () => OrchestratorService.listThreads(currentSiteId as string, 5),
    enabled: !!currentSiteId,
    refetchOnWindowFocus: false,
  });

  const handleNewChat = () => {
    clearLiveArtifacts();
    setThreadId(null);
    router.push("/dashboard");
    onMobileClose?.();
  };

  const handleSelectThread = (id: string) => {
    clearLiveArtifacts();
    setThreadId(id);
    router.push(`/dashboard?thread=${encodeURIComponent(id)}`);
    onMobileClose?.();
  };

  const isActiveNav = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const isCollapsedDesktop = collapsed;

  const sidebarContent = (
    <>
      <div className={cn("border-b border-gray-800 py-4", collapsed ? "px-2" : "px-4")}>
        <SiteSwitcher collapsed={isCollapsedDesktop} />
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

            return (
              <li key={href}>
                {collapsed ? <SidebarTooltip label={label}>{link}</SidebarTooltip> : link}
              </li>
            );
          })}
        </ul>

        <div className={cn("mt-6", collapsed ? "px-1" : "px-4")}>
          <div
            className={cn(
              "mb-2 flex items-center",
              collapsed ? "justify-center" : "justify-between"
            )}
          >
            {collapsed ? (
              <SidebarTooltip label="Recent chats">
                <div className="flex justify-center p-2 text-gray-500">
                  <MessageSquare className="w-4 h-4" aria-hidden="true" />
                </div>
              </SidebarTooltip>
            ) : (
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <MessageSquare className="w-3.5 h-3.5" aria-hidden="true" />
                Recent chats
              </div>
            )}
            {collapsed ? (
              <SidebarTooltip label="New chat">
                <button
                  type="button"
                  onClick={handleNewChat}
                  className="flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-900 hover:text-white"
                  aria-label="Start new chat"
                >
                  <Plus className="w-4 h-4" aria-hidden="true" />
                </button>
              </SidebarTooltip>
            ) : (
              <button
                type="button"
                onClick={handleNewChat}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
                aria-label="Start new chat"
              >
                <Plus className="w-3 h-3" aria-hidden="true" />
                New
              </button>
            )}
          </div>

          {!collapsed && threadsQuery.isLoading && <p className="text-xs text-gray-500 py-2">Loading…</p>}
          {!collapsed && threadsQuery.isError && (
            <p className="text-xs text-red-300 py-2">Couldn&apos;t load chats.</p>
          )}
          {!collapsed && threadsQuery.data?.length === 0 && !threadsQuery.isLoading && (
            <p className="text-xs text-gray-500 py-2">No conversations yet.</p>
          )}
          <ul className="space-y-0.5">
            {threadsQuery.data?.map((t) => {
              const displayTitle = t.title || "New conversation";
              const isActive = pathname === "/dashboard" && threadId === t._id;

              if (collapsed) {
                const initial = displayTitle.charAt(0).toUpperCase();
                return (
                  <li key={t._id}>
                    <SidebarTooltip label={displayTitle}>
                      <button
                        type="button"
                        onClick={() => handleSelectThread(t._id)}
                        aria-label={displayTitle}
                        className={cn(
                          "mx-auto flex h-9 w-9 items-center justify-center rounded-md text-xs font-semibold transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary border border-primary/40"
                            : "text-gray-400 hover:bg-gray-900 hover:text-white border border-transparent"
                        )}
                      >
                        {initial}
                      </button>
                    </SidebarTooltip>
                  </li>
                );
              }

              return (
                <li key={t._id}>
                  <button
                    type="button"
                    onClick={() => handleSelectThread(t._id)}
                    className={cn(
                      "w-full text-left rounded-md px-3 py-2 transition-colors",
                      isActive
                        ? "bg-primary/10 text-white border-l-2 border-primary"
                        : "text-gray-400 hover:bg-gray-900 hover:text-white border-l-2 border-transparent"
                    )}
                  >
                    <p className="text-sm font-medium truncate">{displayTitle}</p>
                    <p className="text-xs text-gray-500">{formatThreadTimestamp(t.last_activity_at)}</p>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
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

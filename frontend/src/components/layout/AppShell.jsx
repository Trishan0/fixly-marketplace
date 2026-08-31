import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Briefcase,
  Users,
  Bell,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronRight,
  MessageSquare,
  DollarSign,
  Wrench,
  BarChart3,
  Shield,
  FileText,
  Tag,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronDown,
  Plus,
  MoreHorizontal,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { cn, getInitials } from "../../lib/utils";
import { BrandLogo } from "../shared/BrandLogo";
import api from "../../lib/api";
import { ThemeToggleIconButton } from "../shared/ThemeToggle";

const customerNav = [
  { href: "/customer-dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/jobs", icon: Briefcase, label: "My Jobs" },
  { href: "/find-workers", icon: Users, label: "Find Workers" },
];

const workerNav = [
  { href: "/worker-dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/jobs/feed", icon: Briefcase, label: "Open Jobs" },
  { href: "/invites", icon: MessageSquare, label: "Invites" },
  { href: "/jobs/assigned", icon: Wrench, label: "My Work" },
  { href: "/earnings", icon: DollarSign, label: "Earnings" },
];

const workerNavSimplified = [
  { href: "/worker-dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/jobs/feed", icon: Briefcase, label: "New Jobs" },
  { href: "/invites", icon: MessageSquare, label: "Invites" },
  { href: "/jobs/assigned", icon: Wrench, label: "My Jobs" },
  { href: "/earnings", icon: DollarSign, label: "Earnings" },
];

const adminNav = [
  { href: "/admin", icon: BarChart3, label: "Dashboard" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/workers", icon: Shield, label: "Workers" },
  { href: "/admin/reports", icon: FileText, label: "Reports" },
  { href: "/admin/categories", icon: Tag, label: "Categories" },
];

const customerMobileNav = [
  { href: "/customer-dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/jobs/new", icon: Plus, label: "Post", featured: true },
  { href: "/find-workers", icon: Users, label: "Workers" },
];

const workerMobileNav = [
  { href: "/worker-dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/jobs/feed", icon: Briefcase, label: "Find jobs" },
  { href: "/invites", icon: MessageSquare, label: "Invites" },
  { href: "/jobs/assigned", icon: Wrench, label: "My work" },
];

const adminMobileNav = [
  { href: "/admin", icon: BarChart3, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/workers", icon: Shield, label: "Workers" },
  { href: "/admin/reports", icon: FileText, label: "Reports" },
];

function routeIsActive(pathname, href) {
  if (pathname === href) return true;
  if (pathname === "/jobs/new") return false;
  if (["/", "/admin", "/worker-dashboard", "/customer-dashboard"].includes(href)) return false;
  return pathname.startsWith(`${href}/`);
}

function MobileBottomNav({ items, unread, onMore }) {
  const location = useLocation();

  return (
    <nav
      className="mobile-bottom-nav lg:hidden"
      aria-label="Primary navigation"
    >
      <div className="grid grid-cols-5">
        {items.map(({ href, icon: Icon, label, featured }) => {
          const active = routeIsActive(location.pathname, href);
          return (
            <Link
              key={href}
              to={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold transition-colors",
                active
                  ? "text-sky-600 dark:text-sky-300"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-10 items-center justify-center rounded-xl transition-colors",
                  active && "bg-sky-50 dark:bg-sky-950/60",
                  featured && "bg-sky-600 text-white shadow-sm dark:bg-sky-500",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span>{label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400"
          aria-label="Open more navigation options"
        >
          <span className="relative flex h-7 w-10 items-center justify-center rounded-xl">
            <MoreHorizontal className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1 top-0 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-950" />
            )}
          </span>
          <span>More</span>
        </button>
      </div>
    </nav>
  );
}

function AccountMenu({ unread }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-2xl bg-sky-100 text-sm font-bold text-sky-700">
          {user?.profile_photo ? (
            <img
              src={user.profile_photo}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            getInitials(user?.full_name)
          )}
        </div>
        <div className="hidden min-w-0 sm:block">
          <p className="truncate text-sm font-semibold text-slate-900">
            {user?.full_name}
          </p>
          <p className="text-xs capitalize text-slate-500">{user?.role}</p>
        </div>
        {(unread || 0) > 0 && (
          <span className="hidden rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-bold text-white sm:inline-flex">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
        <ChevronDown className="h-4 w-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-30 w-60 rounded-2xl border border-slate-200 bg-white p-2 shadow-[0_18px_40px_rgba(15,23,42,0.14)] dark:border-slate-700 dark:bg-slate-900">
          <Link
            to="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <User className="h-4 w-4" /> View Profile
          </Link>
          <Link
            to="/profile/edit"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <User className="h-4 w-4" /> Edit Profile
          </Link>
          <Link
            to="/settings"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Settings className="h-4 w-4" /> Settings
          </Link>
          <Link
            to="/notifications"
            onClick={() => setOpen(false)}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <Bell className="h-4 w-4" /> Notifications
          </Link>
          <div className="px-3 py-2">
            <ThemeToggleIconButton className="h-11 w-full justify-center rounded-xl" />
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" /> Log Out
          </button>
        </div>
      )}
    </div>
  );
}

function SidebarContent({ navItems, onClose, collapsed = false, unread = 0 }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobileDrawer = Boolean(onClose);

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  return (
    <div
      className={cn(
        "flex h-full flex-col transition-all duration-200",
        isMobileDrawer
          ? "bg-white text-slate-950 dark:bg-slate-950 dark:text-white"
          : "bg-slate-950 text-white",
        collapsed ? "w-20" : "w-64",
      )}
    >
      {/* Logo */}
      <div
        className={cn(
          "flex items-center border-b py-5",
          isMobileDrawer ? "border-slate-200 dark:border-white/10" : "border-white/10",
          collapsed ? "justify-center px-3" : "justify-between px-6",
        )}
      >
        <div className="flex items-center gap-2">
          {collapsed ? (
            <BrandLogo compact className="h-8 w-8" />
          ) : (
            <BrandLogo onDark={!isMobileDrawer} className="h-8 w-[7.5rem]" />
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white lg:hidden"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* User info */}
      <div
        className={cn(
          "border-b py-4",
          isMobileDrawer ? "border-slate-200 dark:border-white/10" : "border-white/10",
          collapsed ? "px-2" : "px-4",
        )}
      >
        <div
          className={cn(
            "flex px-2",
            collapsed ? "justify-center" : "items-center gap-3",
          )}
        >
          <div className={cn(
            "flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl text-sm font-bold",
            isMobileDrawer
              ? "bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
              : "bg-sky-500/20 text-sky-400",
          )}>
            {user?.profile_photo ? (
              <img
                src={user.profile_photo}
                alt=""
                className="w-9 h-9 object-cover"
              />
            ) : (
              getInitials(user?.full_name)
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {user?.full_name}
              </p>
              <p className={cn("text-xs capitalize", isMobileDrawer ? "text-slate-500 dark:text-slate-400" : "text-slate-400")}>{user?.role}</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(({ href, icon: Icon, label, badge }) => {
          const isProfileRoute =
            href === "/profile" &&
            (location.pathname === "/profile" ||
              location.pathname.startsWith("/profile/") ||
              location.pathname === `/workers/${user?.id}` ||
              location.pathname === `/customers/${user?.id}`);

          const isActive =
            isProfileRoute ||
            location.pathname === href ||
            (href.length > 1 &&
              ![
                "/",
                "/admin",
                "/worker-dashboard",
                "/customer-dashboard",
              ].includes(href) &&
              location.pathname.startsWith(href)) ||
            location.pathname === href;

          return (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              title={collapsed ? label : undefined}
              className={cn(
                "flex items-center rounded-xl transition-all duration-150 font-medium text-sm relative",
                collapsed ? "justify-center px-3 py-3" : "gap-3 px-4 py-2.5",
                isActive
                  ? "bg-sky-600 text-white"
                  : isMobileDrawer
                    ? "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white"
                    : "text-slate-400 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {!collapsed && <span className="flex-1">{label}</span>}
              {badge && (
                <span
                  className={cn(
                    "bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center flex-shrink-0",
                    collapsed
                      ? "absolute right-1 top-1 h-4 min-w-4 px-1"
                      : "w-5 h-5",
                  )}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              )}
              {!collapsed && isActive && (
                <ChevronRight className="w-3 h-3 opacity-60 flex-shrink-0" />
              )}
            </Link>
          );
        })}
      </nav>

      {onClose && (
        <div className="border-t border-slate-200 px-3 py-3 dark:border-white/10">
          {[
            { href: "/profile", icon: User, label: "Public profile" },
            { href: "/profile/edit", icon: User, label: "Edit profile" },
            { href: "/settings", icon: Settings, label: "Settings" },
            { href: "/notifications", icon: Bell, label: "Notifications", badge: unread },
          ].map(({ href, icon: Icon, label, badge }) => (
            <Link
              key={href}
              to={href}
              onClick={onClose}
              className="flex min-h-11 items-center gap-3 rounded-xl px-4 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{label}</span>
              {badge > 0 && <span className="rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">{badge > 9 ? '9+' : badge}</span>}
            </Link>
          ))}
          <div className="mt-1 px-2">
            <ThemeToggleIconButton className="h-11 w-full justify-center rounded-xl border-slate-200 bg-slate-50 text-slate-600 shadow-none dark:border-white/10 dark:bg-white/5 dark:text-slate-300" />
          </div>
        </div>
      )}

      {/* Logout */}
      <div className={cn("border-t px-3 pb-6 pt-2", isMobileDrawer ? "border-slate-200 dark:border-white/10" : "border-white/10")}>
        <button
          type="button"
          onClick={handleLogout}
          title={collapsed ? "Sign Out" : undefined}
          className={cn(
            "flex w-full rounded-xl text-sm font-medium transition-all",
            isMobileDrawer
              ? "text-slate-500 hover:bg-red-50 hover:text-red-600 dark:text-slate-400 dark:hover:bg-red-400/10 dark:hover:text-red-400"
              : "text-slate-400 hover:bg-red-400/10 hover:text-red-400",
            collapsed
              ? "justify-center px-3 py-3"
              : "items-center gap-3 px-4 py-2.5",
          )}
        >
          <LogOut className="w-4 h-4" />
          {!collapsed && "Sign Out"}
        </button>
      </div>
    </div>
  );
}

export function AppShell({ children }) {
  const { user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(() => {
    try {
      return localStorage.getItem("fixly_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });
  const location = useLocation();
  const mainRef = useRef(null);

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unread = notifData?.unread || 0;

  useEffect(() => {
    try {
      localStorage.setItem("fixly_sidebar_collapsed", String(desktopCollapsed));
    } catch {
      // ignore storage issues
    }
  }, [desktopCollapsed]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileOpen]);

  let baseNav = customerNav;
  if (user?.role === "worker") {
    baseNav =
      user.dashboard_mode === "simplified" ? workerNavSimplified : workerNav;
  } else if (user?.role === "admin") {
    baseNav = adminNav;
  }

  // Inject unread badge on notifications link
  const navItems = baseNav;
  let mobileNavItems = customerMobileNav;
  if (user?.role === "worker") mobileNavItems = workerMobileNav;
  if (user?.role === "admin") mobileNavItems = adminMobileNav;

  const currentSection = useMemo(() => {
    if (
      location.pathname === "/profile" ||
      location.pathname.startsWith("/profile/") ||
      location.pathname === `/workers/${user?.id}` ||
      location.pathname === `/customers/${user?.id}`
    )
      return "Profile";
    if (location.pathname.startsWith("/settings")) return "Settings";
    if (location.pathname.startsWith("/notifications")) return "Notifications";

    const activeItem = navItems.find((item) => {
      if (item.href === "/profile") {
        return (
          location.pathname === "/profile" ||
          location.pathname.startsWith("/profile/") ||
          location.pathname === `/workers/${user?.id}` ||
          location.pathname === `/customers/${user?.id}`
        );
      }
      return (
        location.pathname === item.href ||
        (item.href.length > 1 && location.pathname.startsWith(item.href))
      );
    });
    return activeItem?.label || "Fixly";
  }, [location.pathname, navItems, user?.id]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-slate-50 dark:bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.10),transparent_18%),linear-gradient(180deg,#020617_0%,#0f172a_100%)]">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col flex-shrink-0 shadow-lg transition-all duration-200",
          desktopCollapsed ? "w-20" : "w-64",
        )}
      >
        <SidebarContent navItems={navItems} collapsed={desktopCollapsed} />
      </aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-40 lg:hidden"
              onClick={() => setMobileOpen(false)}
              aria-hidden="true"
            />
            <motion.aside
              initial={{ x: -270 }}
              animate={{ x: 0 }}
              exit={{ x: -270 }}
              transition={{ type: "spring", damping: 28, stiffness: 220 }}
              className="fixed bottom-0 left-0 top-0 z-50 flex flex-col shadow-2xl lg:hidden"
              role="dialog"
              aria-modal="true"
              aria-label="Navigation menu"
            >
              <SidebarContent
                navItems={navItems}
                onClose={() => setMobileOpen(false)}
                unread={unread}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="hidden lg:flex items-center justify-between gap-4 border-b border-slate-200/80 bg-white/90 px-6 py-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/75">
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setDesktopCollapsed((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              aria-label={
                desktopCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              {desktopCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
                Workspace
              </p>
              <h1 className="text-lg font-bold text-slate-900">
                {currentSection}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggleIconButton />
            <AccountMenu unread={unread} />
          </div>
        </header>

        {/* Mobile top bar */}
        <header className="flex min-h-16 flex-shrink-0 items-center gap-3 border-b border-slate-100 bg-white/95 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5 text-slate-700 dark:text-slate-200" />
          </button>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
            <BrandLogo compact className="h-6 w-6" />
              <span className="truncate text-sm font-bold text-slate-900 dark:text-white">
                {currentSection}
              </span>
            </div>
          </div>
          <Link
            to="/notifications"
            className="relative flex h-11 w-11 items-center justify-center rounded-xl text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label={unread ? `${unread} unread notifications` : "Notifications"}
          >
            <Bell className="h-5 w-5" />
            {unread > 0 && (
              <span className="absolute right-2 top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Link>
        </header>

        {/* Page content */}
        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18 }}
            className="min-h-full"
          >
            {children}
          </motion.div>
        </main>
        <MobileBottomNav
          items={mobileNavItems}
          unread={unread}
          onMore={() => setMobileOpen(true)}
        />
      </div>
    </div>
  );
}

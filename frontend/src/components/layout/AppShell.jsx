import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Bell,
  Briefcase,
  ChevronDown,
  FileText,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Mail,
  Menu,
  MessagesSquare,
  Moon,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  Scale,
  Settings,
  Shield,
  Sun,
  Tag,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../context/ThemeContext";
import { cn, getInitials } from "../../lib/utils";
import { BrandLogo } from "../shared/BrandLogo";
import api from "../../lib/api";

const customerNav = [
  { href: "/customer-dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/jobs", icon: Briefcase, label: "My jobs" },
  { href: "/find-workers", icon: Users, label: "Find workers" },
  { href: "/messages", icon: MessagesSquare, label: "Messages" },
];

const workerNav = [
  { href: "/worker-dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/jobs/feed", icon: Briefcase, label: "Open jobs" },
  { href: "/invites", icon: Mail, label: "Invites" },
  { href: "/proposals", icon: FileText, label: "My proposals" },
  { href: "/jobs/assigned", icon: Wrench, label: "My work" },
  { href: "/messages", icon: MessagesSquare, label: "Messages" },
  { href: "/earnings", icon: Wallet, label: "Earnings" },
];

const workerNavSimplified = workerNav.map((item) =>
  item.href === "/jobs/feed" ? { ...item, label: "New jobs" } : item.href === "/jobs/assigned" ? { ...item, label: "My jobs" } : item,
);

const adminNav = [
  { href: "/admin", icon: BarChart3, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/workers", icon: Shield, label: "Workers" },
  { href: "/admin/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/admin/reports", icon: FileText, label: "Reports" },
  { href: "/admin/disputes", icon: Scale, label: "Disputes" },
  { href: "/admin/categories", icon: Tag, label: "Categories" },
];

const customerMobileNav = [
  { href: "/customer-dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/jobs/new", icon: Plus, label: "Post", featured: true },
  { href: "/messages", icon: MessagesSquare, label: "Messages" },
];

const workerMobileNav = [
  { href: "/worker-dashboard", icon: LayoutDashboard, label: "Home" },
  { href: "/jobs/feed", icon: Briefcase, label: "Jobs" },
  { href: "/jobs/assigned", icon: Wrench, label: "My work" },
  { href: "/messages", icon: MessagesSquare, label: "Messages" },
];

const adminMobileNav = [
  { href: "/admin", icon: BarChart3, label: "Overview" },
  { href: "/admin/users", icon: Users, label: "Users" },
  { href: "/admin/reports", icon: FileText, label: "Reports" },
  { href: "/admin/disputes", icon: Scale, label: "Disputes" },
];

// Pages that aren't in the nav but still need a name in the top bar.
const EXTRA_SECTIONS = [
  [/^\/jobs\/new$/, "Post a job"],
  [/^\/jobs\/[^/]+\/propose$/, "Proposal"],
  [/^\/jobs\/[^/]+$/, "Job"],
  [/^\/profile/, "Profile"],
  [/^\/(workers|customers)\//, "Profile"],
  [/^\/settings/, "Settings"],
  [/^\/notifications/, "Notifications"],
];

/** The nav item that best matches the path (longest prefix wins). */
function activeHref(items, pathname) {
  if (pathname === "/jobs/new") return null;
  let best = null;
  for (const { href } of items) {
    if (pathname === href || pathname.startsWith(`${href}/`)) {
      if (!best || href.length > best.length) best = href;
    }
  }
  return best;
}

function CountBadge({ count, className }) {
  if (!count) return null;
  return (
    <span className={cn("inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] font-semibold leading-none text-brand-on tabular-nums", className)}>
      {count > 99 ? "99+" : count}
    </span>
  );
}

function UserAvatar({ user, size = "h-8 w-8" }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-subtle text-xs font-semibold text-brand-text", size)}>
      {user?.profile_photo ? <img src={user.profile_photo} alt="" className="h-full w-full object-cover" /> : getInitials(user?.full_name)}
    </span>
  );
}

function SidebarNav({ items, active, collapsed, onNavigate }) {
  return (
    <ul className="space-y-0.5">
      {items.map(({ href, icon: Icon, label, badge }) => {
        const isActive = active === href;
        return (
          <li key={href}>
            <Link
              to={href}
              onClick={onNavigate}
              aria-current={isActive ? "page" : undefined}
              title={collapsed ? label : undefined}
              className={cn(
                "group flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm font-medium transition-colors [@media(pointer:coarse)]:h-11",
                collapsed && "justify-center px-0",
                isActive ? "bg-subtle text-fg" : "text-fg-muted hover:bg-subtle hover:text-fg",
              )}
            >
              <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden="true" />
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {badge > 0 && (collapsed
                ? <span className="absolute ml-5 -mt-5 h-2 w-2 rounded-full bg-brand" aria-label={`${badge} unread`} />
                : <CountBadge count={badge} />)}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Sidebar({ items, active, collapsed = false, onClose }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const drawer = Boolean(onClose);
  return (
    <div className={cn("flex h-full flex-col border-r border-line bg-surface", collapsed ? "w-16" : "w-60")}>
      <div className={cn("flex h-14 shrink-0 items-center border-b border-line", collapsed ? "justify-center px-2" : "justify-between px-4")}>
        <Link to="/dashboard" onClick={onClose} aria-label="Fixly dashboard" className="flex items-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand">
          {collapsed ? <BrandLogo compact className="h-7 w-7" /> : <BrandLogo className="h-7 w-[6.6rem]" />}
        </Link>
        {drawer && (
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-control text-fg-muted hover:bg-subtle hover:text-fg" aria-label="Close navigation">
            <X className="h-5 w-5" />
          </button>
        )}
      </div>

      <nav className={cn("flex-1 overflow-y-auto py-3", collapsed ? "px-2" : "px-3")} aria-label="Main">
        <SidebarNav items={items} active={active} collapsed={collapsed} onNavigate={onClose} />
      </nav>

      <div className={cn("border-t border-line py-3", collapsed ? "px-2" : "px-3")}>
        <Link
          to="/safety"
          onClick={onClose}
          title={collapsed ? "Help & safety" : undefined}
          className={cn("flex h-9 items-center gap-2.5 rounded-control px-2.5 text-sm font-medium text-fg-muted hover:bg-subtle hover:text-fg [@media(pointer:coarse)]:h-11", collapsed && "justify-center px-0")}
        >
          <LifeBuoy className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
          {!collapsed && "Help & safety"}
        </Link>
        {drawer && (
          <button
            type="button"
            onClick={() => { logout(); navigate("/auth"); }}
            className="flex h-11 w-full items-center gap-2.5 rounded-control px-2.5 text-sm font-medium text-fg-muted hover:bg-subtle hover:text-fg"
          >
            <LogOut className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Sign out
          </button>
        )}
      </div>
    </div>
  );
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const { resolvedTheme, setThemeMode } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => { if (ref.current && !ref.current.contains(event.target)) setOpen(false); };
    const onKey = (event) => {
      if (event.key === "Escape") { setOpen(false); buttonRef.current?.focus(); }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = "flex h-9 w-full items-center gap-2.5 rounded-control px-2.5 text-left text-sm text-fg hover:bg-subtle [@media(pointer:coarse)]:h-11";
  const close = () => setOpen(false);

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 items-center gap-1.5 rounded-full pl-0.5 pr-1.5 hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand [@media(pointer:coarse)]:h-11"
      >
        <UserAvatar user={user} />
        <ChevronDown className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-11 z-40 w-64 rounded-overlay border border-line bg-surface p-1.5 shadow-overlay">
          <div className="flex items-center gap-3 px-2.5 py-2">
            <UserAvatar user={user} size="h-9 w-9" />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-fg">{user?.full_name}</p>
              <p className="truncate text-xs text-fg-muted">{user?.email}</p>
            </div>
          </div>
          <div className="my-1 h-px bg-line" />
          {user?.role !== "admin" && (
            <Link role="menuitem" to="/profile" onClick={close} className={item}><User className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> View profile</Link>
          )}
          <Link role="menuitem" to="/profile/edit" onClick={close} className={item}><Pencil className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Edit profile</Link>
          <Link role="menuitem" to="/settings" onClick={close} className={item}><Settings className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Settings</Link>
          <button role="menuitem" type="button" onClick={() => setThemeMode(resolvedTheme === "dark" ? "light" : "dark")} className={item}>
            {resolvedTheme === "dark" ? <Sun className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> : <Moon className="h-4 w-4 text-fg-subtle" aria-hidden="true" />}
            {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
          </button>
          <div className="my-1 h-px bg-line" />
          <button role="menuitem" type="button" onClick={() => { logout(); navigate("/auth"); }} className={item}>
            <LogOut className="h-4 w-4 text-fg-subtle" aria-hidden="true" /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function IconLink({ to, icon: Icon, label, count }) {
  const { pathname } = useLocation();
  const active = pathname.startsWith(to);
  return (
    <Link
      to={to}
      aria-label={count > 0 ? `${label}, ${count} unread` : label}
      aria-current={active ? "page" : undefined}
      title={label}
      className={cn(
        "relative flex h-9 w-9 items-center justify-center rounded-control text-fg-muted transition-colors hover:bg-subtle hover:text-fg [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
        active && "bg-subtle text-fg",
      )}
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      {count > 0 && <CountBadge count={count} className="absolute -right-0.5 -top-0.5 ring-2 ring-surface" />}
    </Link>
  );
}

function MobileBottomNav({ items, active, unread, onMore }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
      <div className="grid grid-cols-5">
        {items.map(({ href, icon: Icon, label, featured, badge }) => {
          const isActive = active === href;
          return (
            <Link
              key={href}
              to={href}
              aria-current={isActive ? "page" : undefined}
              className={cn("relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium", isActive ? "text-brand" : "text-fg-muted")}
            >
              <span className={cn("relative flex items-center justify-center", featured && "h-7 w-7 rounded-full bg-brand text-brand-on")}>
                <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
                {badge > 0 && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-surface" aria-label={`${badge} unread`} />}
              </span>
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={onMore} className="relative flex h-14 flex-col items-center justify-center gap-1 text-[11px] font-medium text-fg-muted" aria-label="More navigation">
          <span className="relative">
            <MoreHorizontal className="h-[18px] w-[18px]" aria-hidden="true" />
            {unread > 0 && <span className="absolute -right-2 -top-1 h-2 w-2 rounded-full bg-brand ring-2 ring-surface" />}
          </span>
          More
        </button>
      </div>
    </nav>
  );
}

export function AppShell({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  const mainRef = useRef(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("fixly_sidebar_collapsed") === "true"; } catch { return false; }
  });

  const { data: notifData } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.get("/notifications").then((r) => r.data),
    refetchInterval: 30000,
    enabled: !!user,
  });
  const unread = notifData?.unread || 0;

  const canMessage = user?.role === "customer" || user?.role === "worker";
  const { data: messageData } = useQuery({
    queryKey: ["messages-unread"],
    queryFn: () => api.get("/messages/unread-count").then((r) => r.data),
    refetchInterval: 30000,
    enabled: canMessage,
  });
  const unreadMessages = messageData?.unread || 0;

  useEffect(() => {
    try { localStorage.setItem("fixly_sidebar_collapsed", String(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 });
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return undefined;
    const onKey = (event) => { if (event.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const withBadges = (items) => items.map((item) => (item.href === "/messages" && unreadMessages > 0 ? { ...item, badge: unreadMessages } : item));
  const navItems = withBadges(
    user?.role === "admin" ? adminNav : user?.role === "worker" ? (user.dashboard_mode === "simplified" ? workerNavSimplified : workerNav) : customerNav,
  );
  const mobileItems = withBadges(user?.role === "admin" ? adminMobileNav : user?.role === "worker" ? workerMobileNav : customerMobileNav);
  const active = activeHref(navItems, location.pathname);
  const mobileActive = activeHref(mobileItems, location.pathname);

  const section = useMemo(() => {
    const fromNav = navItems.find((item) => item.href === active)?.label;
    if (fromNav && location.pathname === active) return fromNav;
    const extra = EXTRA_SECTIONS.find(([pattern]) => pattern.test(location.pathname));
    if (location.pathname.startsWith("/messages")) return "Messages";
    return extra?.[1] || fromNav || "Fixly";
  }, [navItems, active, location.pathname]);

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-canvas">
      <aside className="hidden shrink-0 lg:flex">
        <Sidebar items={navItems} active={active} collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-slate-950/40" onClick={() => setMobileOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 animate-[drawer-in_0.2s_ease-out] shadow-overlay">
            <Sidebar items={navItems} active={active} onClose={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:px-4">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-control text-fg-muted hover:bg-subtle hover:text-fg lg:hidden [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            className="hidden h-9 w-9 items-center justify-center rounded-control text-fg-muted hover:bg-subtle hover:text-fg lg:flex"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-[18px] w-[18px]" /> : <PanelLeftClose className="h-[18px] w-[18px]" />}
          </button>
          <div className="mx-1 hidden h-5 w-px bg-line lg:block" aria-hidden="true" />
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{section}</p>

          <div className="flex items-center gap-1">
            {canMessage && <IconLink to="/messages" icon={MessagesSquare} label="Messages" count={unreadMessages} />}
            <IconLink to="/notifications" icon={Bell} label="Notifications" count={unread} />
            <div className="mx-1 h-5 w-px bg-line" aria-hidden="true" />
            <AccountMenu />
          </div>
        </header>

        <main ref={mainRef} id="main-content" className="flex-1 overflow-y-auto overscroll-contain pb-[calc(3.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
        </main>
        <MobileBottomNav items={mobileItems} active={mobileActive} unread={unread} onMore={() => setMobileOpen(true)} />
      </div>
    </div>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  Compass,
  PlusSquare,
  MessageCircle,
  Sparkles,
  MapPin,
  Tv,
  Wallet,
  User,
  Wifi,
  WifiOff,
  Bell,
  CloudUpload,
  Search,
  BarChart3,
  Bookmark,
  Settings,
  HelpCircle,
  LayoutGrid,
  Radio,
  Server,
  Phone,
  Trophy,
  GraduationCap,
} from "lucide-react";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { Avatar } from "./ui";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/create", label: "Create", icon: PlusSquare },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/ai", label: "AI", icon: Sparkles },
  { to: "/maps", label: "Maps", icon: MapPin },
  { to: "/watch", label: "Watch", icon: Tv },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/hub", label: "Hub", icon: LayoutGrid },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/clubs", label: "Clubs", icon: Trophy },
  { to: "/learn", label: "Academy", icon: GraduationCap },
  { to: "/live", label: "LIVE", icon: Radio },
  { to: "/platform", label: "Platform", icon: Server },
  { to: "/dashboard", label: "Creator dashboard", icon: BarChart3 },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
] as const;

const mobileNav = ["/", "/explore", "/create", "/messages", "/profile"];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { online, setOnline, relay, syncRelay, passport, conversations } = useApp();
  const { notices } = useWorkspace();
  const { user } = useSession();
  const [remoteUnread, setRemoteUnread] = useState(0);
  useEffect(() => {
    if (!user) {
      setRemoteUnread(0);
      return;
    }
    let active = true;
    const refreshUnread = async () => {
      const { count, error } = await (supabase as any)
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id)
        .is("read_at", null);
      if (active && !error) setRemoteUnread(count ?? 0);
    };
    void refreshUnread();
    const channel = supabase
      .channel(`notification-badge:${user.id}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "notifications",
        filter: `recipient_id=eq.${user.id}`,
      }, () => void refreshUnread())
      .subscribe();
    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
  const noticeCount = notices.filter((n) => !n.read).length + remoteUnread;
  const unread = conversations.reduce((a, c) => a + c.unread, 0);

  return (
    <div className="min-h-screen md:pl-20 lg:pl-60">
      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col border-r bg-sidebar px-3 py-5 md:flex lg:w-60">
        <Link to="/" className="mb-8 flex items-center gap-2 px-2" aria-label="NEXORA home">
          <span className="bg-brand grid h-9 w-9 place-items-center rounded-xl font-display text-lg font-bold text-primary-foreground shadow-glow">
            N
          </span>
          <span className="hidden font-display text-xl font-bold tracking-tight lg:block">
            NEXORA
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
          {nav.map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                  active
                    ? "bg-sidebar-accent text-foreground"
                    : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5 shrink-0", active && "text-accent")} aria-hidden />
                <span className="hidden lg:inline">{label}</span>
                {to === "/messages" && unread > 0 && (
                  <span className="ml-auto hidden rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground lg:inline">
                    {unread}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="hidden rounded-2xl border bg-card p-3 lg:block">
          <div className="flex items-center gap-2">
            <Avatar name={passport.name} size={34} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{passport.name}</p>
              <p className="text-xs text-muted-foreground">Pulse rep {passport.reputation}</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2 md:hidden" aria-label="NEXORA home">
          <span className="bg-brand grid h-8 w-8 place-items-center rounded-lg font-display font-bold text-primary-foreground">
            N
          </span>
          <span className="font-display text-lg font-bold">NEXORA</span>
        </Link>
        <Link
          to="/explore"
          className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex"
          aria-label="Universal search"
        >
          <Search className="h-4 w-4" />
          Search NEXORA
        </Link>
        <div className="ml-auto flex items-center gap-2">
          {relay.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={syncRelay}
              disabled={!online}
              className="flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-xs font-semibold text-accent disabled:opacity-60"
              aria-label={`Offline relay: ${relay.length} queued. ${online ? "Sync now" : "Waiting for connection"}`}
            >
              <CloudUpload className="h-3.5 w-3.5" aria-hidden /> {relay.length} queued
              {online ? " · Sync" : ""}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setOnline(!online)}
            aria-label={online ? "Simulate offline" : "Reconnect demo"}
            aria-pressed={!online}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold",
              online ? "text-success" : "border-destructive/40 bg-destructive/10 text-destructive",
            )}
            title="Simulate going offline"
          >
            {online ? (
              <Wifi className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <WifiOff className="h-3.5 w-3.5" aria-hidden />
            )}
            {online ? "Online" : "Offline"}
          </Button>
          <Link
            to="/live"
            className="flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 text-xs font-bold text-destructive-foreground"
            aria-label="LIVE now"
          >
            <Radio className="h-3.5 w-3.5" />
            LIVE
          </Link>
          <Link
            to="/ai"
            className="hidden h-9 w-9 place-items-center rounded-full hover:bg-muted sm:grid"
            aria-label="AI assistant"
          >
            <Sparkles className="h-5 w-5" />
          </Link>
          <Button asChild variant="ghost" size="icon" className="relative rounded-full">
            <Link to="/notifications" aria-label={noticeCount > 0 ? `Notifications, ${noticeCount} unread` : "Notifications"}>
              <Bell className="h-5 w-5" />
              {noticeCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
                  {noticeCount > 9 ? "9+" : noticeCount}
                </span>
              )}
            </Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 md:px-8 md:pb-12">{children}</main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Main"
        className="glass fixed inset-x-0 bottom-0 z-40 flex justify-around border-t px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:hidden"
      >
        {nav
          .filter((n) => mobileNav.includes(n.to))
          .map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            if (to === "/create")
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label="Create"
                  className="bg-brand -mt-1 grid h-11 w-14 place-items-center rounded-2xl text-primary-foreground shadow-glow"
                >
                  <PlusSquare className="h-5 w-5" />
                </Link>
              );
            return (
              <Link
                key={to}
                to={to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex w-14 flex-col items-center gap-0.5 text-[11px]",
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-accent")} aria-hidden />
                {label}
                {to === "/messages" && unread > 0 && (
                  <span className="absolute right-2 top-0 h-2 w-2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}

export const moreLinks = nav.filter((n) => !mobileNav.includes(n.to));

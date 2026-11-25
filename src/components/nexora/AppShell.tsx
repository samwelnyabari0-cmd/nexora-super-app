import { Link, useRouterState } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  Home,
  ArrowLeft,
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
  Gamepad2,
  GraduationCap,
  ShieldCheck,
  Clapperboard,
  Video,
} from "lucide-react";
import { useWorkspace } from "@/features/core/workspace";
import { Button } from "@/components/ui/button";
import { useApp } from "@/features/core/store";
import { Avatar } from "./ui";
import { NexoraMark } from "./NexoraMark";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { OfflinePackManager } from "./OfflinePackManager";
import { flushOfflineMessages } from "@/lib/offline-messages";
import { getQueuedMessages } from "@/lib/offline-storage";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/match-center", label: "Arena", icon: Gamepad2 },
  { to: "/reels", label: "Reels", icon: Clapperboard },
  { to: "/create", label: "Create", icon: PlusSquare },
  { to: "/videos", label: "Videos", icon: Video },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/ai", label: "AI", icon: Sparkles },
  { to: "/maps", label: "Maps", icon: MapPin },
  { to: "/watch", label: "Watch", icon: Tv },
  { to: "/wallet", label: "Wallet", icon: Wallet },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/hub", label: "Hub", icon: LayoutGrid },
  { to: "/calls", label: "Calls", icon: Phone },
  { to: "/clubs", label: "Squads", icon: Trophy },
  { to: "/learn", label: "Academy", icon: GraduationCap },
  { to: "/live", label: "LIVE", icon: Radio },
  { to: "/platform", label: "Platform", icon: Server },
  { to: "/dashboard", label: "Creator dashboard", icon: BarChart3 },
  { to: "/saved", label: "Saved", icon: Bookmark },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help", icon: HelpCircle },
] as const;

const mobileNav = ["/", "/explore", "/reels", "/create", "/videos", "/messages", "/profile"];

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const isPublicProfile = path.startsWith("/profile/");
  const search = useRouterState({ select: (s) => s.location.search });
  const activeConversation = path === "/messages" && Boolean(
    (search as Record<string, unknown>).recipient || (search as Record<string, unknown>).group
  );
  const { online, setOnline, relay, syncRelay, passport, conversations } = useApp();
  const { notices } = useWorkspace();
  const { user } = useSession();
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "NEXORA_OUTBOX_SYNC") {
        window.dispatchEvent(new Event("nexora:outbox-sync"));
      }
    };
    const onOnline = () => window.dispatchEvent(new Event("nexora:outbox-sync"));
    navigator.serviceWorker.addEventListener("message", onMessage);
    window.addEventListener("online", onOnline);
    void navigator.serviceWorker.register("/sw.js", { scope: "/" })
      .then((registration) => registration.update())
      .catch((error) => {
        console.warn("NEXORA offline support could not be registered:", error);
      });
    return () => {
      navigator.serviceWorker.removeEventListener("message", onMessage);
      window.removeEventListener("online", onOnline);
    };
  }, []);
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    let syncing = false;

    const syncAllQueuedMessages = async () => {
      if (!active || syncing || !navigator.onLine) return;
      syncing = true;
      try {
        const queued = await getQueuedMessages(user.id);
        const visited = new Set<string>();
        let sentCount = 0;

        for (const item of queued) {
          const key = item.kind + ":" + item.conversationId;
          if (visited.has(key)) continue;
          visited.add(key);
          const result = await flushOfflineMessages(
            supabase as any,
            user.id,
            item.kind,
            item.conversationId,
          );
          sentCount += result.sent;
          if (result.error) {
            console.warn("NEXORA could not sync a queued message yet:", result.error);
          }
        }

        if (active && sentCount > 0) {
          window.dispatchEvent(new Event("nexora:outbox-updated"));
        }
      } catch (error) {
        console.warn("NEXORA offline message sync will retry:", error);
      } finally {
        syncing = false;
      }
    };

    void syncAllQueuedMessages();
    window.addEventListener("online", syncAllQueuedMessages);
    window.addEventListener("nexora:outbox-sync", syncAllQueuedMessages);
    return () => {
      active = false;
      window.removeEventListener("online", syncAllQueuedMessages);
      window.removeEventListener("nexora:outbox-sync", syncAllQueuedMessages);
    };
  }, [user?.id]);

  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setIsPlatformAdmin(false);
      return () => { active = false; };
    }
    void (supabase as any).rpc("my_is_platform_admin").then(({ data, error }: { data: unknown; error: unknown }) => {
      if (active) setIsPlatformAdmin(!error && data === true);
    });
    return () => { active = false; };
  }, [user?.id]);
  useEffect(() => {
    const isTextEntry = (target: EventTarget | null) =>
      target instanceof HTMLElement &&
      (target.matches("input:not([type='file']):not([type='button']):not([type='submit']), textarea, [contenteditable='true']") ||
        target.isContentEditable);

    const updateKeyboardState = () => {
      const viewport = window.visualViewport;
      const viewportReduced = Boolean(viewport && window.innerHeight - viewport.height > 120);
      setKeyboardOpen(viewportReduced || isTextEntry(document.activeElement));
    };
    const handleFocusOut = () => window.setTimeout(updateKeyboardState, 0);

    document.addEventListener("focusin", updateKeyboardState);
    document.addEventListener("focusout", handleFocusOut);
    window.addEventListener("resize", updateKeyboardState);
    window.visualViewport?.addEventListener("resize", updateKeyboardState);
    updateKeyboardState();
    return () => {
      document.removeEventListener("focusin", updateKeyboardState);
      document.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("resize", updateKeyboardState);
      window.visualViewport?.removeEventListener("resize", updateKeyboardState);
    };
  }, []);

  const navItems = isPlatformAdmin
    ? [...nav, { to: "/admin/finance" as const, label: "Admin Finance", icon: ShieldCheck }]
    : nav;
  const isFeaturePage =
    path.startsWith("/admin") ||
    moreLinks.some(({ to }) => path === to || path.startsWith(`${to}/`));

  // Track authenticated activity across every page rendered inside AppShell.
  useEffect(() => {
    if (!user?.id) return;

    const updateLastSeen = async () => {
      if (document.visibilityState !== "visible") return;
      await (supabase as any)
        .from("user_presence")
        .upsert(
          { user_id: user.id, last_seen: new Date().toISOString() },
          { onConflict: "user_id" }
        );
    };

    void updateLastSeen();
    const interval = window.setInterval(() => void updateLastSeen(), 30000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") void updateLastSeen();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", updateLastSeen);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", updateLastSeen);
    };
  }, [user?.id]);

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
      .channel(`notification-badge:${user.id}`, { config: { private: true } })
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
          <NexoraMark className="h-9 w-9 rounded-xl shadow-glow" />
          <span className="hidden font-display text-xl font-bold tracking-tight lg:block">
            NEXORA
          </span>
        </Link>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto" aria-label="Main">
          {navItems.map(({ to, label, icon: Icon }) => {
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

      {!activeConversation && !isPublicProfile && (
      <>
      {/* Top bar */}
      <header className="glass sticky top-0 z-30 flex h-14 items-center gap-3 border-b px-4 md:px-6">
        {isFeaturePage && (
          <Link
            to="/profile"
            search={{ handle: "", explore: true }}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold transition hover:bg-muted"
            aria-label="Back to Tools & Services"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            <span>Tools &amp; Services</span>
          </Link>
        )}
        <Link to="/" className="flex items-center gap-2 md:hidden" aria-label="NEXORA home">
          <NexoraMark className="h-8 w-8 rounded-lg" />
          <span className="font-display text-lg font-bold">NEXORA</span>
        </Link>
        <Link
          to="/explore"
          search={{ post: "" }}
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
      </>
      )}

      <main className={cn("min-w-0 max-w-full", activeConversation ? "w-full max-w-none overflow-x-hidden p-0" : isPublicProfile ? "mx-auto w-full max-w-3xl overflow-x-clip px-0 pb-28 pt-0 md:px-0 md:pb-12" : "mx-auto w-full max-w-6xl overflow-x-clip px-4 pb-28 pt-5 md:px-8 md:pb-12", !activeConversation && keyboardOpen && "pb-5")}>{children}</main>

      {/* Mobile bottom nav */}
      {!activeConversation && <nav
        aria-label="Main"
        className={cn("glass fixed inset-x-0 bottom-0 z-40 flex justify-around border-t px-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2 md:hidden", keyboardOpen && "hidden")}
      >
        {navItems
          .filter((n) => mobileNav.includes(n.to))
          .map(({ to, label, icon: Icon }) => {
            const active = to === "/" ? path === "/" : path.startsWith(to);
            if (to === "/create")
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label="Create"
                  className="bg-brand -mt-1 grid h-11 w-10 shrink-0 place-items-center rounded-2xl text-primary-foreground shadow-glow sm:w-11"
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
                  "relative flex w-10 shrink-0 flex-col items-center gap-0.5 text-[10px] sm:w-11 sm:text-[11px]",
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
      </nav>}
    </div>
  );
}

export const moreLinks = nav.filter((n) => !mobileNav.includes(n.to));

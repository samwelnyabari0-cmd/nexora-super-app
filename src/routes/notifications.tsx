import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronRight, FileText, Heart, MessageCircle, Package, Settings2, ShieldCheck, WalletCards, Trash2 } from "lucide-react";
import { useWorkspace } from "@/features/core/workspace";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { enablePushNotifications } from "@/lib/push";
import { toast } from "sonner";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Notifications — NEXORA" }, { name: "description", content: "Real-time activity, monetization, order, and security alerts." }] }),
  component: Notifications,
});

type Category = "monetization" | "orders" | "brand_deals" | "interactions" | "messages" | "ecosystem" | "account_safety" | "verification";
type AccountType = "personal" | "creator" | "business";
type Notice = { id: string; category: Category; event: string; title: string; detail: string; time: string; read: boolean; href: string; icon: typeof Bell; accounts?: AccountType[]; color?: string; eligible?: boolean };
const demoNotices: Notice[] = [
  { id: "tip-1", category: "monetization", event: "TIP RECEIVED", title: "You received a tip of $10.00 USD", detail: '≈ KSh 1,300 from @john_doe on “Vite Custom Config”', time: "2m ago", read: false, href: "/wallet", icon: WalletCards, accounts: ["creator", "business"], color: "text-emerald-400" },
  { id: "order-1", category: "orders", event: "ORDERS & DEALS", title: "New Order #NX-8821 for KSh 5,850", detail: "Buyer: Wanjiku Eats · Paid — Processing", time: "14m ago", read: false, href: "/messages", icon: Package, accounts: ["personal", "business"], color: "text-amber-400" },
  { id: "comment-1", category: "interactions", event: "INTERACTIONS", title: "@sarah_m commented on your Short", detail: '“Awesome tutorial!”', time: "1h ago", read: true, href: "/watch/p4?focus=comments", icon: MessageCircle, accounts: ["personal", "creator", "business"], color: "text-rose-400" },
  { id: "campaign-1", category: "orders", event: "CAMPAIGN BRIEFS", title: 'Brand Deal Approved: “Tech Gear Review”', detail: "Escrow locked. Upload post to claim.", time: "2d ago", read: true, href: "/campaigns", icon: FileText, accounts: ["creator", "business"], color: "text-violet-400" },
  { id: "security-1", category: "account_safety", event: "ACCOUNT & SAFETY", title: "Review your identity verification status", detail: "Keep your account eligible for payouts and marketplace deals.", time: "3d ago", read: true, href: "/profile/status/strikes", icon: ShieldCheck, accounts: ["personal", "creator", "business"], color: "text-red-400" },
  { id: "brand-1", category: "brand_deals", event: "BRAND DEALS", title: "Campaign brief approved", detail: "Escrow locked. Upload your deliverable to claim it.", time: "4h ago", read: false, href: "/campaigns", icon: FileText, accounts: ["creator", "business"], color: "text-violet-400", eligible: true },
  { id: "dm-1", category: "messages", event: "MESSAGES & DMS", title: "New customer inquiry", detail: "Wanjiku Eats sent an order chat message.", time: "28m ago", read: false, href: "/messages", icon: MessageCircle, accounts: ["personal", "creator", "business"], color: "text-cyan-400" },
  { id: "multiplier-1", category: "ecosystem", event: "ECOSYSTEM MULTIPLIER", title: "Your ES score increased", detail: "Keep publishing consistently to unlock lower platform fees.", time: "1d ago", read: true, href: "/profile/dashboard", icon: WalletCards, accounts: ["creator", "business"], color: "text-amber-400", eligible: true },
  { id: "verify-1", category: "verification", event: "VERIFICATION", title: "Payout verification approved", detail: "Your identity and payout method are ready for settlement.", time: "2d ago", read: true, href: "/profile/verification", icon: ShieldCheck, accounts: ["creator", "business"], color: "text-slate-300", eligible: true },
];
const tabs: Array<{ id: "all" | Category; label: string }> = [{ id: "all", label: "All" }, { id: "interactions", label: "Interactions" }, { id: "messages", label: "Messages & DMs" }, { id: "monetization", label: "Monetization" }, { id: "orders", label: "Orders & Sales" }, { id: "brand_deals", label: "Brand Deals" }, { id: "ecosystem", label: "Multiplier" }, { id: "account_safety", label: "Safety" }, { id: "verification", label: "Verification" }];

function Notifications() {
  const { notices: localNotices, markRead } = useWorkspace();
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("all");
  const accountType: AccountType = (user?.user_metadata?.account_type as AccountType) ?? "personal";
  const [remoteNotices, setRemoteNotices] = useState<Array<{ id: string; body: string; kind: string; read_at: string | null; created_at: string }>>([]);
  const [remoteUnreadCount, setRemoteUnreadCount] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const PAGE_SIZE = 50;
  useEffect(() => {
    if (!user) {
      setRemoteNotices([]);
      setRemoteUnreadCount(0);
      setHasMore(false);
      return;
    }

    let active = true;
    const refreshUnreadCount = async () => {
      const { count, error } = await (supabase as any).from("notifications").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null);
      if (active && !error) setRemoteUnreadCount(count ?? 0);
    };
    const loadNotifications = async () => {
      const { data, error } = await (supabase as any)
        .from("notifications")
        .select("id, body, kind, read_at, created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (!active) return;
      if (error) {
        console.error("Could not load notifications:", error.message);
        return;
      }
      setRemoteNotices(data ?? []);
      setHasMore((data ?? []).length === PAGE_SIZE);
    };

    void loadNotifications();
    void refreshUnreadCount();
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `recipient_id=eq.${user.id}`,
        },
        (payload) => {
          if (!active) return;
          void refreshUnreadCount();
          void refreshUnreadCount();
          if (payload.eventType === "INSERT") {
            const notice = payload.new as { id: string; body: string; kind: string; read_at: string | null; created_at: string };
            setRemoteNotices((items) => [notice, ...items.filter((item) => item.id !== notice.id)].slice(0, 50));
            toast("New notification", { description: notice.body });
          } else if (payload.eventType === "UPDATE") {
            const notice = payload.new as { id: string; body: string; kind: string; read_at: string | null; created_at: string };
            setRemoteNotices((items) => items.map((item) => item.id === notice.id ? notice : item));
          } else if (payload.eventType === "DELETE") {
            const removed = payload.old as { id?: string };
            if (removed.id) setRemoteNotices((items) => items.filter((item) => item.id !== removed.id));
          }
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("Notification live updates unavailable:", status);
        }
      });

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
  const notices = useMemo(() => {
    const remote: Notice[] = remoteNotices.map((item) => {
      const kind = item.kind?.toLowerCase() ?? "activity";
      const isMessage = kind.includes("message");
      const isComment = kind.includes("comment");
      const isLike = kind.includes("like");
      const isFollow = kind.includes("follow");
      return {
        id: item.id,
        category: isMessage ? "messages" : "interactions",
        event: isMessage ? "MESSAGE" : "INTERACTION",
        title: isFollow ? "New follower" : isLike ? "New like" : isComment ? "New comment" : isMessage ? "New message" : "Activity update",
        detail: item.body,
        time: new Date(item.created_at).toLocaleString(),
        read: Boolean(item.read_at),
        href: isMessage ? "/messages" : "/",
        icon: isMessage ? MessageCircle : isComment ? MessageCircle : isLike ? Heart : isFollow ? Bell : Bell,
      };
    });
    const local: Notice[] = localNotices.map((item) => ({ id: item.id, category: item.kind === "safety" ? "account_safety" : "interactions", event: item.kind === "safety" ? "SECURITY" : "INTERACTIONS", title: item.title, detail: item.detail, time: "Just now", read: item.read, href: "/notifications", icon: item.kind === "safety" ? ShieldCheck : Heart }));
    return user ? [...remote, ...local] : [...demoNotices, ...local];
  }, [localNotices, remoteNotices, user]);
  const eligibleNotices = notices.filter((item) => !item.accounts || item.accounts.includes(accountType));
  const visible = (activeTab === "all" ? eligibleNotices : eligibleNotices.filter((item) => item.category === activeTab));
  const unreadCount = user ? remoteUnreadCount + localNotices.filter((item) => !item.read).length : eligibleNotices.filter((item) => !item.read).length;
  async function markAllRead() {
    markRead();
    if (user) {
      const readAt = new Date().toISOString();
      const { error } = await (supabase as any).from("notifications").update({ read_at: readAt }).eq("recipient_id", user.id).is("read_at", null);
      if (error) { toast.error("Could not mark all notifications as read."); return; }
      setRemoteUnreadCount(0);
      setRemoteNotices((items) => items.map((item) => ({ ...item, read_at: readAt })));
    }
  }
  async function markOneRead(id: string) {
    if (remoteNotices.some((item) => item.id === id)) {
      const readAt = new Date().toISOString();
      setRemoteNotices((items) => items.map((item) => item.id === id ? { ...item, read_at: readAt } : item));
      const { error } = await (supabase as any).from("notifications").update({ read_at: readAt }).eq("id", id).eq("recipient_id", user?.id);
      if (error) toast.error("Could not mark notification as read.");
      else setRemoteUnreadCount((count) => Math.max(0, count - 1));
    } else markRead(id);
  }
  async function deleteOne(id: string) {
    if (!user) return;
    const { error } = await (supabase as any).from("notifications").delete().eq("id", id).eq("recipient_id", user.id);
    if (error) { toast.error("Could not delete notification. Check notification delete permissions."); return; }
    const wasUnread = remoteNotices.some((item) => item.id === id && !item.read_at);
    setRemoteNotices((items) => items.filter((item) => item.id !== id));
    if (wasUnread) setRemoteUnreadCount((count) => Math.max(0, count - 1));
    toast.success("Notification deleted.");
  }
  async function deleteAll() {
    if (!user || !window.confirm("Delete all your notifications? This cannot be undone.")) return;
    const { error } = await (supabase as any).from("notifications").delete().eq("recipient_id", user.id);
    if (error) { toast.error("Could not delete notifications. Check notification delete permissions."); return; }
    setRemoteNotices([]);
    setRemoteUnreadCount(0);
    setHasMore(false);
    toast.success("All notifications deleted.");
  }
  async function loadMore() {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data, error } = await (supabase as any).from("notifications").select("id, body, kind, read_at, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).range(remoteNotices.length, remoteNotices.length + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (error) { toast.error("Could not load more notifications."); return; }
    const next = data ?? [];
    setRemoteNotices((items) => [...items, ...next.filter((item: { id: string }) => !items.some((existing) => existing.id === item.id))]);
    setHasMore(next.length === PAGE_SIZE);
  }
  async function deleteOne(id: string) {
    if (!user) return;
    const wasUnread = remoteNotices.some((item) => item.id === id && !item.read_at);
    const { error } = await (supabase as any).from("notifications").delete().eq("id", id).eq("recipient_id", user.id);
    if (error) { toast.error("Could not delete notification. Check notification delete permissions."); return; }
    setRemoteNotices((items) => items.filter((item) => item.id !== id));
    if (wasUnread) setRemoteUnreadCount((count) => Math.max(0, count - 1));
    toast.success("Notification deleted.");
  }
  async function deleteAll() {
    if (!user || !window.confirm("Delete all your notifications? This cannot be undone.")) return;
    const { error } = await (supabase as any).from("notifications").delete().eq("recipient_id", user.id);
    if (error) { toast.error("Could not delete notifications. Check notification delete permissions."); return; }
    setRemoteNotices([]);
    setRemoteUnreadCount(0);
    setHasMore(false);
    toast.success("All notifications deleted.");
  }
  async function loadMore() {
    if (!user || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const { data, error } = await (supabase as any).from("notifications").select("id, body, kind, read_at, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).range(remoteNotices.length, remoteNotices.length + PAGE_SIZE - 1);
    setLoadingMore(false);
    if (error) { toast.error("Could not load more notifications."); return; }
    const next = data ?? [];
    setRemoteNotices((items) => [...items, ...next.filter((item: { id: string }) => !items.some((existing) => existing.id === item.id))]);
    setHasMore(next.length === PAGE_SIZE);
  }
  return <div className="space-y-4"><PageHeader title="Notifications" action={<DemoBadge>Synced activity</DemoBadge>} /><p className="text-sm text-muted-foreground">{unreadCount} unread {unreadCount === 1 ? "notification" : "notifications"}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void markAllRead()} disabled={unreadCount === 0}><CheckCheck /> Mark all read</Button>{user && remoteNotices.length > 0 && <Button variant="outline" onClick={() => void deleteAll()}><Trash2 /> Clear all</Button>}<Button variant="outline" onClick={async () => { try { await enablePushNotifications(); toast.success("Push notifications enabled on this device."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not enable notifications."); } }}><Bell /> Push settings</Button><Button variant="ghost" size="icon" aria-label="Notification preferences" title="Notification preferences"><Settings2 /></Button></div><div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1">{tabs.map((tab) => <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${activeTab === tab.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}</div><section aria-label="Notification feed" className="space-y-3"><p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today</p>{visible.map((notice) => { const Icon = notice.icon; return <article key={notice.id} className={`rounded-2xl border p-4 transition-colors ${notice.read ? "bg-card" : "border-primary/40 bg-primary/5"}`}><div className="flex gap-3"><div className="mt-0.5 rounded-xl bg-muted p-2"><Icon className={`h-4 w-4 ${notice.color ?? "text-primary"}`} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400">{notice.event}</p><time className="text-xs text-muted-foreground">{notice.time}</time></div><p className="mt-1 font-semibold">{notice.title}</p><p className="mt-1 text-sm text-muted-foreground">{notice.detail}</p><div className="mt-3 flex flex-wrap items-center gap-2"><a href={notice.href} onClick={() => markOneRead(notice.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Open details <ChevronRight className="h-3.5 w-3.5" /></a>{!notice.read && <button type="button" onClick={() => markOneRead(notice.id)} className="text-xs text-muted-foreground hover:text-foreground">Mark read</button>}{user && remoteNotices.some((item) => item.id === notice.id) && <button type="button" onClick={() => void deleteOne(notice.id)} className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /> Delete</button>}</div></div></div></article>})}</section>{user && hasMore && <div className="flex justify-center"><Button variant="outline" onClick={() => void loadMore()} disabled={loadingMore}>{loadingMore ? "Loading..." : "Load more"}</Button></div>}{!visible.length && <p className="py-16 text-center text-muted-foreground">You&apos;re all caught up.</p>}</div>;
}

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Bell, CheckCheck, ChevronRight, FileText, Heart, MessageCircle, Package, Settings2, ShieldCheck, WalletCards } from "lucide-react";
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

type Category = "interactions" | "monetization" | "orders" | "system";
type Notice = { id: string; category: Category; event: string; title: string; detail: string; time: string; read: boolean; href: string; icon: typeof Bell };
const demoNotices: Notice[] = [
  { id: "tip-1", category: "monetization", event: "TIP RECEIVED", title: "You received a tip of $10.00 USD", detail: '≈ KSh 1,300 from @john_doe on “Vite Custom Config”', time: "2m ago", read: false, href: "/wallet", icon: WalletCards },
  { id: "order-1", category: "orders", event: "ORDERS & DEALS", title: "New Order #NX-8821 for KSh 5,850", detail: "Buyer: Wanjiku Eats · Paid — Processing", time: "14m ago", read: false, href: "/messages", icon: Package },
  { id: "comment-1", category: "interactions", event: "INTERACTIONS", title: "@sarah_m commented on your Short", detail: '“Awesome tutorial!”', time: "1h ago", read: true, href: "/watch/p4?focus=comments", icon: MessageCircle },
  { id: "campaign-1", category: "orders", event: "CAMPAIGN BRIEFS", title: 'Brand Deal Approved: “Tech Gear Review”', detail: "Escrow locked. Upload post to claim.", time: "2d ago", read: true, href: "/campaigns", icon: FileText },
  { id: "security-1", category: "system", event: "SECURITY", title: "Review your identity verification status", detail: "Keep your account eligible for payouts and marketplace deals.", time: "3d ago", read: true, href: "/profile/verification", icon: ShieldCheck },
];
const tabs: Array<{ id: "all" | Category; label: string }> = [{ id: "all", label: "All" }, { id: "interactions", label: "Interactions" }, { id: "monetization", label: "Monetization" }, { id: "orders", label: "Orders" }, { id: "system", label: "System" }];

function Notifications() {
  const { notices: localNotices, markRead } = useWorkspace();
  const { user } = useSession();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]["id"]>("all");
  const [remoteNotices, setRemoteNotices] = useState<Array<{ id: string; body: string; read_at: string | null; created_at: string }>>([]);
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (supabase as any).from("notifications").select("id, body, read_at, created_at").eq("recipient_id", user.id).order("created_at", { ascending: false }).limit(50);
      setRemoteNotices(data ?? []);
    })();
  }, [user]);
  const notices = useMemo(() => {
    const remote: Notice[] = remoteNotices.map((item) => ({ id: item.id, category: "interactions", event: "ACTIVITY", title: "Activity update", detail: item.body, time: new Date(item.created_at).toLocaleDateString(), read: Boolean(item.read_at), href: "/messages", icon: Bell }));
    const local: Notice[] = localNotices.map((item) => ({ id: item.id, category: item.kind === "safety" ? "system" : "interactions", event: item.kind === "safety" ? "SECURITY" : "INTERACTIONS", title: item.title, detail: item.detail, time: "Just now", read: item.read, href: "/notifications", icon: item.kind === "safety" ? ShieldCheck : Heart }));
    return user ? [...remote, ...local] : [...demoNotices, ...local];
  }, [localNotices, remoteNotices, user]);
  const visible = activeTab === "all" ? notices : notices.filter((item) => item.category === activeTab);
  async function markAllRead() {
    markRead();
    if (user) await (supabase as any).from("notifications").update({ read_at: new Date().toISOString() }).eq("recipient_id", user.id).is("read_at", null);
    setRemoteNotices((items) => items.map((item) => ({ ...item, read_at: new Date().toISOString() })));
  }
  function markOneRead(id: string) {
    if (remoteNotices.some((item) => item.id === id)) {
      void (supabase as any).from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
      setRemoteNotices((items) => items.map((item) => item.id === id ? { ...item, read_at: new Date().toISOString() } : item));
    } else markRead(id);
  }
  return <div className="space-y-4"><PageHeader title="Notifications" action={<DemoBadge>Synced activity</DemoBadge>} /><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void markAllRead()} disabled={!notices.some((item) => !item.read)}><CheckCheck /> Mark all read</Button><Button variant="outline" onClick={async () => { try { await enablePushNotifications(); toast.success("Push notifications enabled on this device."); } catch (error) { toast.error(error instanceof Error ? error.message : "Could not enable notifications."); } }}><Bell /> Push settings</Button><Button variant="ghost" size="icon" aria-label="Notification preferences" title="Notification preferences"><Settings2 /></Button></div><div className="flex gap-1 overflow-x-auto rounded-xl border bg-muted/30 p-1">{tabs.map((tab) => <button type="button" key={tab.id} onClick={() => setActiveTab(tab.id)} className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium ${activeTab === tab.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{tab.label}</button>)}</div><section aria-label="Notification feed" className="space-y-3"><p className="px-1 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Today</p>{visible.map((notice) => { const Icon = notice.icon; return <article key={notice.id} className={`rounded-2xl border p-4 transition-colors ${notice.read ? "bg-card" : "border-primary/40 bg-primary/5"}`}><div className="flex gap-3"><div className="mt-0.5 rounded-xl bg-muted p-2"><Icon className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-cyan-400">{notice.event}</p><time className="text-xs text-muted-foreground">{notice.time}</time></div><p className="mt-1 font-semibold">{notice.title}</p><p className="mt-1 text-sm text-muted-foreground">{notice.detail}</p><div className="mt-3 flex flex-wrap items-center gap-2"><a href={notice.href} onClick={() => markOneRead(notice.id)} className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">Open details <ChevronRight className="h-3.5 w-3.5" /></a>{!notice.read && <button type="button" onClick={() => markOneRead(notice.id)} className="text-xs text-muted-foreground hover:text-foreground">Mark read</button>}</div></div></div></article>})}</section>{!visible.length && <p className="py-16 text-center text-muted-foreground">You&apos;re all caught up.</p>}</div>;
}

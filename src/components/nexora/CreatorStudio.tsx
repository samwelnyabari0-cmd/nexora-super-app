import { useState } from "react";
import { BarChart3, CalendarClock, CircleDollarSign, Crown, Gauge, Gift, MessageSquare, Pin, PlaySquare, Radio, Settings2, Wallet, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const tools = [
  ["Performance dashboard", "Views, watch time, engagement and audience growth", BarChart3],
  ["Format analytics", "Shorts, photo posts and long-form breakdowns", PlaySquare],
  ["Audience insights", "Demographics, peak hours and retention graphs", Gauge],
  ["Content scheduler", "Draft, preview and schedule all formats", CalendarClock],
] as const;

export function CreatorStudio() {
  const [dmSorting, setDmSorting] = useState(true);
  const [subscriberComments, setSubscriberComments] = useState(false);
  const [pinnedRow, setPinnedRow] = useState(true);
  return (
    <section className="space-y-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-background to-indigo-500/10 p-4" aria-labelledby="creator-studio-title">
      <div className="flex items-start justify-between gap-3"><div><p id="creator-studio-title" className="flex items-center gap-2 font-display font-semibold"><Crown className="h-5 w-5 text-purple-300" /> Creator Studio</p><p className="text-xs text-muted-foreground">Analytics, publishing and monetization tools unlocked for Creator accounts.</p></div><span className="rounded-full bg-purple-500/20 px-2 py-1 text-[10px] font-semibold text-purple-200">CREATOR</span></div>
      <div className="grid gap-2 sm:grid-cols-2">{tools.map(([title, description, Icon]) => <div key={title} className="rounded-xl border bg-background/60 p-3"><Icon className="mb-2 h-4 w-4 text-purple-300" /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div>)}</div>
      <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="h-4 w-4 text-emerald-400" /> Monetization suite</p><p className="mt-1 text-xs text-muted-foreground">Memberships from $2.99–$49.99, virtual gifts, micro-tips and paywalled posts/videos.</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-muted p-2">15% Starter fee</span><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">55% ad split</span></div></div><div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-amber-300" /> Wallet payouts</p><p className="mt-1 text-xs text-muted-foreground">Withdraw weekly or on demand to Paystack, M-Pesa or a bank account.</p><button type="button" className="mt-3 rounded-lg border px-2 py-1 text-xs">Set payout method</button></div></div>
      <div className="rounded-xl border p-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-yellow-300" /> Ecosystem multiplier</p><div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span className="rounded-lg bg-muted p-2">Starter<br /><b>15% fee</b></span><span className="rounded-lg bg-muted p-2">Catalyst<br /><b>12% fee</b></span><span className="rounded-lg bg-muted p-2">Pro<br /><b>8% fee</b></span><span className="rounded-lg bg-primary/15 p-2 text-primary">VIP<br /><b>5% fee</b></span></div><p className="mt-2 text-xs text-muted-foreground">Cross-format activity earns +10% to +50% feed priority and ad-pool eligibility.</p></div>
      <div className="space-y-2 rounded-xl border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-sky-300" /> Audience management</p><label className="flex items-center justify-between gap-3 text-xs">DM Inbox: Primary, General, Requests<Switch checked={dmSorting} onCheckedChange={setDmSorting} /></label><label className="flex items-center justify-between gap-3 text-xs">Subscriber-only comments<Switch checked={subscriberComments} onCheckedChange={setSubscriberComments} /></label><label className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-1"><Pin className="h-3.5 w-3.5" /> Featured pinned row (up to 3)</span><Switch checked={pinnedRow} onCheckedChange={setPinnedRow} /></label></div>
      <div className="flex flex-wrap gap-2"><button type="button" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Gift className="h-3.5 w-3.5" /> Configure gifts</button><button type="button" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Radio className="h-3.5 w-3.5" /> Ad revenue eligibility</button><button type="button" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Settings2 className="h-3.5 w-3.5" /> Studio settings</button></div>
    </section>
  );
}

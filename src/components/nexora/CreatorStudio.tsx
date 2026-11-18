import { useState } from "react";
import { BarChart3, CalendarClock, CircleDollarSign, Crown, Gauge, Gift, MessageSquare, Pin, PlaySquare, Radio, Settings2, Wallet, Zap } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { PlatformSafetyControls } from "@/components/nexora/PlatformSafetyControls";
import { supabase } from "@/integrations/supabase/client";

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
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [mpesaPhone, setMpesaPhone] = useState("");
  const [confirmMpesaPhone, setConfirmMpesaPhone] = useState("");
  const [confirmPayoutNumber, setConfirmPayoutNumber] = useState(false);
  const [savingPayoutMethod, setSavingPayoutMethod] = useState(false);
  const [savedDestinationLast4, setSavedDestinationLast4] = useState<string | null>(null);
  const [destinationUnverified, setDestinationUnverified] = useState(false);

  function notifyAction(action: string) {
    toast.success(`${action} is ready to configure`);
  }

  async function saveMpesaDestination(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (savingPayoutMethod) return;

    const phone = mpesaPhone.trim();
    const normalizedPhone = phone.replace(/[\s()+-]/g, "");
    const normalizedConfirmation = confirmMpesaPhone.trim().replace(/[\s()+-]/g, "");
    if (!/^(07|01)\d{8}$|^254(7|1)\d{8}$/.test(normalizedPhone)) {
      toast.error("Enter a valid Kenyan M-Pesa number.");
      return;
    }
    if (!normalizedConfirmation || normalizedPhone !== normalizedConfirmation) {
      toast.error("The M-Pesa numbers do not match. Check both entries.");
      return;
    }
    if (!confirmPayoutNumber) {
      toast.error("Please confirm that this is the correct M-Pesa number.");
      return;
    }

    setSavingPayoutMethod(true);
    try {
      const { data, error } = await supabase.functions.invoke("register-creator-payout-destination", {
        body: { phone },
      });

      if (error) throw error;
      if (!data?.success || !data?.destination_last4) {
        throw new Error(data?.error || "Could not save the payout method.");
      }

      setSavedDestinationLast4(data.destination_last4);
      setDestinationUnverified(true);
      setMpesaPhone("");
      setConfirmMpesaPhone("");
      setConfirmPayoutNumber(false);
      toast.success("M-Pesa payout number saved securely. Verification is still required.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not save the payout method.";
      toast.error(message);
    } finally {
      setSavingPayoutMethod(false);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-background to-indigo-500/10 p-4" aria-labelledby="creator-studio-title">
      <PlatformSafetyControls />
      <div className="flex items-start justify-between gap-3"><div><p id="creator-studio-title" className="flex items-center gap-2 font-display font-semibold"><Crown className="h-5 w-5 text-purple-300" /> Creator Studio</p><p className="text-xs text-muted-foreground">Analytics, publishing and monetization tools unlocked for Creator accounts.</p></div><span className="rounded-full bg-purple-500/20 px-2 py-1 text-[10px] font-semibold text-purple-200">CREATOR</span></div>
      <div className="grid gap-2 sm:grid-cols-2">{tools.map(([title, description, Icon]) => <button type="button" key={title} onClick={() => notifyAction(title)} className="rounded-xl border bg-background/60 p-3 text-left transition-colors hover:bg-background"><Icon className="mb-2 h-4 w-4 text-purple-300" /><p className="text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></button>)}</div>
      <div className="grid gap-2 sm:grid-cols-2"><div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><CircleDollarSign className="h-4 w-4 text-emerald-400" /> Monetization suite</p><p className="mt-1 text-xs text-muted-foreground">Memberships from $2.99–$49.99, virtual gifts, micro-tips and paywalled posts/videos.</p><div className="mt-3 grid grid-cols-2 gap-2 text-xs"><span className="rounded-lg bg-muted p-2">15% Starter fee</span><span className="rounded-lg bg-emerald-500/10 p-2 text-emerald-300">55% ad split</span></div></div><div className="rounded-xl border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><Wallet className="h-4 w-4 text-amber-300" /> Wallet payouts</p><p className="mt-1 text-xs text-muted-foreground">Withdrawals start at KES 1,000. Payouts are not sent until the destination and provider are verified.</p><button type="button" onClick={() => setShowPayoutForm((open) => !open)} aria-expanded={showPayoutForm} className="mt-3 rounded-lg border px-2 py-1 text-xs">{showPayoutForm ? "Close payout setup" : "Set M-Pesa payout method"}</button>
        {showPayoutForm && <form onSubmit={saveMpesaDestination} className="mt-3 space-y-2">
          <label htmlFor="creator-mpesa-phone" className="block text-xs font-medium">Kenyan M-Pesa phone number</label>
          <input id="creator-mpesa-phone" type="tel" inputMode="tel" autoComplete="tel" value={mpesaPhone} onChange={(event) => setMpesaPhone(event.target.value)} placeholder="07XXXXXXXX" maxLength={20} required className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
          <label htmlFor="creator-mpesa-phone-confirm" className="block text-xs font-medium">Confirm M-Pesa phone number</label>
          <input id="creator-mpesa-phone-confirm" type="tel" inputMode="tel" autoComplete="off" value={confirmMpesaPhone} onChange={(event) => setConfirmMpesaPhone(event.target.value)} onPaste={(event) => event.preventDefault()} placeholder="Re-enter 07XXXXXXXX" maxLength={20} required className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500" />
          <label className="flex items-start gap-2 text-[11px] text-muted-foreground"><input type="checkbox" checked={confirmPayoutNumber} onChange={(event) => setConfirmPayoutNumber(event.target.checked)} className="mt-0.5" /><span>I confirm this is the correct M-Pesa number. Payments sent to an incorrect number may not be recoverable.</span></label>
          <p className="text-[11px] text-muted-foreground">Your number is encrypted before it is stored. It is not displayed in full.</p>
          <button type="submit" disabled={savingPayoutMethod || !mpesaPhone.trim() || !confirmMpesaPhone.trim() || !confirmPayoutNumber} className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50">{savingPayoutMethod ? "Saving securely..." : "Save M-Pesa number"}</button>
        </form>}
        {savedDestinationLast4 && <p className="mt-2 text-xs text-muted-foreground">Saved destination ending •••• {savedDestinationLast4} — {destinationUnverified ? "Pending verification" : "Saved"}.</p>}
      </div></div>
      <div className="rounded-xl border p-3"><p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-yellow-300" /> Ecosystem multiplier</p><div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4"><span className="rounded-lg bg-muted p-2">Starter<br /><b>15% fee</b></span><span className="rounded-lg bg-muted p-2">Catalyst<br /><b>12% fee</b></span><span className="rounded-lg bg-muted p-2">Pro<br /><b>8% fee</b></span><span className="rounded-lg bg-primary/15 p-2 text-primary">VIP<br /><b>5% fee</b></span></div><p className="mt-2 text-xs text-muted-foreground">Cross-format activity earns +10% to +50% feed priority and ad-pool eligibility.</p></div>
      <div className="space-y-2 rounded-xl border p-3"><p className="flex items-center gap-2 text-sm font-semibold"><MessageSquare className="h-4 w-4 text-sky-300" /> Audience management</p><label className="flex items-center justify-between gap-3 text-xs">DM Inbox: Primary, General, Requests<Switch checked={dmSorting} onCheckedChange={setDmSorting} /></label><label className="flex items-center justify-between gap-3 text-xs">Subscriber-only comments<Switch checked={subscriberComments} onCheckedChange={setSubscriberComments} /></label><label className="flex items-center justify-between gap-3 text-xs"><span className="flex items-center gap-1"><Pin className="h-3.5 w-3.5" /> Featured pinned row (up to 3)</span><Switch checked={pinnedRow} onCheckedChange={setPinnedRow} /></label></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => notifyAction("Gift configuration")} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Gift className="h-3.5 w-3.5" /> Configure gifts</button><button type="button" onClick={() => notifyAction("Ad revenue eligibility")} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Radio className="h-3.5 w-3.5" /> Ad revenue eligibility</button><button type="button" onClick={() => notifyAction("Studio settings")} className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs"><Settings2 className="h-3.5 w-3.5" /> Studio settings</button></div>
    </section>
  );
}

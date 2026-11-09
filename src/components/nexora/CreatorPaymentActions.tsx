import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Gift, Loader2, LockKeyhole, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { initCreatorPayment, verifyCreatorPayment } from "@/lib/paystack.functions";
import { useSession } from "@/lib/session";

const PAYMENT_REF = "nexora.creator.payment";

export function CreatorPaymentActions({ creatorId }: { creatorId: string }) {
  const { user, ready } = useSession();
  const init = useServerFn(initCreatorPayment);
  const verify = useServerFn(verifyCreatorPayment);
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("100");

  useEffect(() => {
    const url = new URL(window.location.href);
    const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
    if (!reference || url.searchParams.get("payment") !== "return") return;
    setBusy(true);
    verify({ data: { reference } }).then((result) => {
      if (result.paid) toast.success("Payment verified and creator wallet credited");
      else toast.error(result.error ?? "Payment was not completed");
    }).catch(() => toast.error("Could not verify payment")).finally(() => {
      setBusy(false);
      window.history.replaceState({}, "", "/profile");
    });
  }, [verify]);

  async function start(kind: "tip" | "subscription" | "paywall" | "gift", minimum: number) {
    const value = Number(amount);
    if (!user) return toast.error("Sign in to support this creator");
    if (!Number.isFinite(value) || value < minimum) return toast.error(`Enter at least KES ${minimum}`);
    setBusy(true);
    try {
      const result = await init({ data: { amount: value, creatorId, kind, tier: "Starter" } });
      if ("error" in result && result.error) toast.error(result.error);
      else if ("authorizationUrl" in result && result.authorizationUrl) window.location.href = result.authorizationUrl;
    } catch { toast.error("Could not start payment"); } finally { setBusy(false); }
  }

  if (!ready || !user) return <p className="text-xs text-muted-foreground">Sign in to tip, subscribe, or unlock creator content.</p>;
  return <div className="space-y-2"><div className="flex gap-2"><input aria-label="Support amount in KES" inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/[^\d]/g, ""))} className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm" /><span className="self-center text-xs text-muted-foreground">KES</span></div><div className="flex flex-wrap gap-2"><Button type="button" size="sm" disabled={busy} onClick={() => void start("tip", 10)}><Zap className="mr-1 h-3.5 w-3.5" /> Tip</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void start("subscription", 299)}><Star className="mr-1 h-3.5 w-3.5" /> Subscribe</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void start("gift", 10)}><Gift className="mr-1 h-3.5 w-3.5" /> Gift</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void start("paywall", 150)}><LockKeyhole className="mr-1 h-3.5 w-3.5" /> Unlock</Button>{busy && <Loader2 className="h-4 w-4 animate-spin self-center" aria-label="Processing payment" />}</div><p className="flex items-center gap-1 text-[11px] text-muted-foreground"><CreditCard className="h-3 w-3" /> Secure Paystack checkout; wallet credit follows verified payment.</p></div>;
}

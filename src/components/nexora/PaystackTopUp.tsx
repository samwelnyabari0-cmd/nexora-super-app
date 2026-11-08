import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/nexora/ui";
import { initTopUp, verifyTopUp } from "@/lib/paystack.functions";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";

const REF_KEY = "nexora.paystack.ref";

export function PaystackTopUp() {
  const { user, ready } = useSession();
  const { creditWallet } = useApp();
  const init = useServerFn(initTopUp);
  const verify = useServerFn(verifyTopUp);
  const [amt, setAmt] = useState("100");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return;
    const url = new URL(window.location.href);
    const ref = url.searchParams.get("reference") ?? url.searchParams.get("trxref") ?? localStorage.getItem(REF_KEY);
    if (!ref || url.searchParams.get("paystack") !== "return") return;
    setBusy(true);
    verify({ data: { reference: ref } })
      .then((r) => {
        if (r.paid) {
          if (r.recorded) creditWallet(r.amount, "Paystack top-up (test)");
          toast.success(`Top-up confirmed: KES ${r.amount}`);
          setMsg(r.recorded ? "Payment verified and recorded." : "Payment already recorded.");
        } else setMsg(r.error ?? `Payment not completed (${r.paystackStatus ?? "unknown"}).`);
      })
      .catch(() => setMsg("Could not verify the payment."))
      .finally(() => {
        setBusy(false);
        localStorage.removeItem(REF_KEY);
        window.history.replaceState({}, "", "/wallet");
      });
  }, [user, verify, creditWallet]);

  const start = async () => {
    const n = Number(amt);
    if (!(n >= 10)) return setMsg("Minimum top-up is KES 10.");
    setBusy(true);
    setMsg("");
    try {
      const r = await init({ data: { amount: n } });
      if ("error" in r && r.error) return setMsg(r.error);
      if ("authorizationUrl" in r && r.authorizationUrl && r.reference) {
        localStorage.setItem(REF_KEY, r.reference);
        window.location.href = r.authorizationUrl;
      }
    } catch {
      setMsg("Could not start the payment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Panel className="mt-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display font-semibold">Top up with Paystack</p>
        <span className="rounded-full border px-2 py-0.5 text-[11px] uppercase text-accent">Test mode</span>
      </div>
      <p className="text-xs text-muted-foreground">
        Uses Paystack test keys — use Paystack test cards; no real money is charged.
      </p>
      {!user && ready ? (
        <Button asChild variant="outline"><Link to="/auth">Sign in to top up</Link></Button>
      ) : (
        <div className="flex gap-2">
          <input
            aria-label="Top-up amount in KES"
            inputMode="numeric"
            value={amt}
            onChange={(e) => setAmt(e.target.value.replace(/[^\d]/g, ""))}
            className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2.5"
          />
          <Button onClick={start} disabled={busy} className="bg-brand text-primary-foreground">
            {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Pay KES {amt || 0}
          </Button>
        </div>
      )}
      {msg && <p role="status" className="text-sm text-muted-foreground">{msg}</p>}
    </Panel>
  );
}

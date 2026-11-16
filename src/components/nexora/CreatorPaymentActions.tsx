import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, Loader2, Star, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  initCreatorMonetizationPayment,
  verifyCreatorMonetizationPayment,
} from "@/lib/paystack.functions";
import { useSession } from "@/lib/session";

export function CreatorPaymentActions({ creatorId }: { creatorId: string }) {
  const { user, ready } = useSession();
  const init = useServerFn(initCreatorMonetizationPayment);
  const verify = useServerFn(verifyCreatorMonetizationPayment);
  const [busy, setBusy] = useState(false);
  const [tipAmount, setTipAmount] = useState("100");

  useEffect(() => {
    const url = new URL(window.location.href);
    const reference = url.searchParams.get("reference") ?? url.searchParams.get("trxref");
    if (!reference || url.searchParams.get("payment") !== "return") return;

    setBusy(true);
    verify({ data: { reference } })
      .then((result) => {
        if (result.paid) {
          toast.success("Payment verified. Creator earnings have been credited.");
        } else {
          toast.error(result.error ?? "Payment was not completed.");
        }
      })
      .catch(() => toast.error("Could not verify the payment."))
      .finally(() => {
        setBusy(false);
        window.history.replaceState({}, "", "/profile");
      });
  }, [verify]);

  async function start(kind: "tip" | "subscription") {
    if (!user) return toast.error("Sign in to support this creator.");

    const amount = Number(tipAmount);
    if (kind === "tip" && (!Number.isFinite(amount) || amount < 10 || amount > 1_000_000)) {
      return toast.error("Enter a tip between KES 10 and KES 1,000,000.");
    }

    setBusy(true);
    try {
      const result = await init({
        data: {
          creatorId,
          kind,
          ...(kind === "tip" ? { tipAmountKes: amount } : {}),
        },
      });

      if ("error" in result && result.error) {
        toast.error(result.error);
      } else if ("authorizationUrl" in result && result.authorizationUrl) {
        window.location.href = result.authorizationUrl;
      } else {
        toast.error("Could not start the payment.");
      }
    } catch {
      toast.error("Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }

  if (!ready || !user) {
    return <p className="text-xs text-muted-foreground">Sign in to tip or subscribe to this creator.</p>;
  }

  if (user.id === creatorId) {
    return <p className="text-xs text-muted-foreground">Your creator payment options will appear to other users.</p>;
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          aria-label="Tip amount in KES"
          inputMode="numeric"
          value={tipAmount}
          onChange={(event) => setTipAmount(event.target.value.replace(/[^\d]/g, ""))}
          className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm"
        />
        <span className="self-center text-xs text-muted-foreground">KES tip</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy} onClick={() => void start("tip")}>
          <Zap className="mr-1 h-3.5 w-3.5" /> Support creator
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void start("subscription")}>
          <Star className="mr-1 h-3.5 w-3.5" /> Subscribe monthly
        </Button>
        {busy && <Loader2 className="h-4 w-4 animate-spin self-center" aria-label="Processing payment" />}
      </div>
      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
        <CreditCard className="h-3 w-3" />
        Secure Paystack checkout. Subscription pricing is set by the creator in USD and charged in KES.
      </p>
    </div>
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Send } from "lucide-react";
import { fmtKES } from "@/features/core/data";
import { useApp } from "@/features/core/store";
import { DemoBadge, PageHeader, Panel } from "@/components/nexora/ui";
import { toast } from "sonner";
import { PaystackTopUp } from "@/components/nexora/PaystackTopUp";

export const Route = createFileRoute("/wallet")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Wallet — NEXORA" },
      { name: "description", content: "Demo KES wallet with mock transfers." },
      { property: "og:title", content: "Wallet — NEXORA" },
      { property: "og:description", content: "Demo KES wallet." },
    ],
  }),
  component: WalletPage,
});

function WalletPage() {
  const { balance, txns, sendMoney } = useApp();
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const n = Number(amt);
  const err = !to.trim()
    ? "Enter a recipient"
    : !(n > 0)
      ? "Enter an amount"
      : n > balance
        ? "Insufficient demo balance"
        : "";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageHeader title="Wallet" action={<DemoBadge>Mock money</DemoBadge>} />
        <div className="bg-brand rounded-3xl p-6 text-primary-foreground shadow-glow">
          <p className="text-sm opacity-80">Demo balance</p>
          <p className="font-display text-4xl font-bold">{fmtKES(balance)}</p>
          <p className="mt-2 text-xs opacity-80">
            No real payment provider connected. Nothing here moves real money.
          </p>
        </div>
        <PaystackTopUp />
        <Panel className="mt-4 space-y-3">
          <p className="font-display font-semibold">Send money (demo)</p>
          {step === "form" ? (
            <>
              <input
                aria-label="Recipient"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                placeholder="Recipient name or @handle"
                className="w-full rounded-xl border bg-background px-3 py-2.5"
              />
              <input
                aria-label="Amount in KES"
                inputMode="decimal"
                value={amt}
                onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder="Amount (KES)"
                className="w-full rounded-xl border bg-background px-3 py-2.5"
              />
              <input
                aria-label="Note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full rounded-xl border bg-background px-3 py-2.5"
              />
              {amt && err && (
                <p role="alert" className="text-sm text-destructive">
                  {err}
                </p>
              )}
              <button
                disabled={!!err}
                onClick={() => setStep("confirm")}
                className="bg-brand flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Review
              </button>
            </>
          ) : (
            <>
              <p>
                Send <b>{fmtKES(n)}</b> to <b>{to}</b>?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setStep("form")} className="flex-1 rounded-xl border py-2.5">
                  Back
                </button>
                <button
                  onClick={() => {
                    sendMoney(to, n, note);
                    toast.success("Demo transfer complete");
                    setTo("");
                    setAmt("");
                    setNote("");
                    setStep("form");
                  }}
                  className="bg-brand flex-1 rounded-xl py-2.5 font-semibold text-primary-foreground"
                >
                  Confirm (demo)
                </button>
              </div>
            </>
          )}
        </Panel>
      </div>
      <Panel className="h-fit">
        <p className="mb-2 font-display font-semibold">
          Transactions <span className="text-xs text-muted-foreground">(simulated)</span>
        </p>
        <ul className="divide-y">
          {txns.map((t) => (
            <li key={t.id} className="flex items-center gap-3 py-3">
              <span
                className={
                  t.kind === "in"
                    ? "grid h-9 w-9 place-items-center rounded-full bg-success/15 text-success"
                    : "grid h-9 w-9 place-items-center rounded-full bg-muted"
                }
              >
                {t.kind === "in" ? (
                  <ArrowDownLeft className="h-4 w-4" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.at}</p>
              </div>
              <p
                className={
                  t.kind === "in" ? "text-sm font-semibold text-success" : "text-sm font-semibold"
                }
              >
                {t.kind === "in" ? "+" : "−"}
                {fmtKES(t.amount)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

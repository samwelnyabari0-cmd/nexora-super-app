import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Send, Globe } from "lucide-react";
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
      { name: "description", content: "Verified KES wallet and Paystack top-ups." },
      { property: "og:title", content: "Wallet — NEXORA" },
      { property: "og:description", content: "Verified KES wallet and Paystack top-ups." },
    ],
  }),
  component: WalletPage,
});

const CURRENCIES = ["USD", "EUR", "GBP", "KES", "NGN", "ZAR"] as const;
const FX_TO_USD: Record<(typeof CURRENCIES)[number], number> = { USD: 1, EUR: 1.09, GBP: 1.27, KES: 0.0077, NGN: 0.00062, ZAR: 0.055 };
const SYMBOLS: Record<(typeof CURRENCIES)[number], string> = { USD: "$", EUR: "€", GBP: "£", KES: "KSh", NGN: "₦", ZAR: "R" };
const formatCurrency = (amount: number, currency: (typeof CURRENCIES)[number]) => `${SYMBOLS[currency]} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gatewayFor = (currency: (typeof CURRENCIES)[number]) => ["KES", "NGN", "ZAR"].includes(currency) ? "Paystack / Mobile Money" : "Coming soon — Stripe / international cards";

function WalletPage() {
  const { txns } = useApp();
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("USD");
  const liveBalance = 0;
  const liveTxns = txns.filter((t) => t.id.startsWith("paystack:"));
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm">("form");
  const n = Number(amt);
  const err = !to.trim()
    ? "Enter a recipient"
    : !(n > 0)
      ? "Enter an amount"
      : n > liveBalance
        ? "Insufficient verified balance"
        : "";
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div>
        <PageHeader title="Wallet" action={<DemoBadge>Live ledger</DemoBadge>} />
        <Panel className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4 text-cyan-400" /> Currency</label><select aria-label="Wallet currency" value={currency} onChange={(event) => setCurrency(event.target.value as (typeof CURRENCIES)[number])} className="rounded-xl border bg-background px-3 py-2 text-sm">{CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{CURRENCIES.map((item) => <button type="button" key={item} onClick={() => setCurrency(item)} className={`rounded-xl border p-3 text-left transition-colors hover:bg-muted ${currency === item ? "border-primary bg-primary/10" : ""}`}><p className="text-xs text-muted-foreground">{item} balance</p><p className="mt-1 font-semibold">{formatCurrency(item === currency ? liveBalance : liveBalance * FX_TO_USD[currency] / FX_TO_USD[item], item)}</p></button>)}</div>
          <p className="text-xs text-muted-foreground">Gateway: {gatewayFor(currency)} · FX conversion fee estimate: 1.5%–2% shown before settlement.</p>
        </Panel>
        <div className="bg-brand rounded-3xl p-6 text-primary-foreground shadow-glow">
          <p className="text-sm opacity-80">Available balance</p>
          <p className="font-display text-4xl font-bold">{formatCurrency(liveBalance, currency)}</p>
          <p className="mt-2 text-xs opacity-80">
            Balance updates only after a verified Paystack webhook. No demo funds are shown.
          </p>
        </div>
        {["KES", "NGN", "ZAR"].includes(currency) ? <PaystackTopUp /> : <Panel className="border-dashed"><p className="text-sm font-semibold">International card top-ups are coming soon</p><p className="mt-1 text-xs text-muted-foreground">Paystack is active for supported African currencies. Stripe and other international gateways will be added later.</p></Panel>}
        <Panel className="mt-4 space-y-3">
          <p className="font-display font-semibold">Send money</p>
          <p className="text-sm text-muted-foreground">Transfers are locked until a verified wallet balance is available.</p>
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
                aria-label={`Amount in ${currency}`}
                inputMode="decimal"
                value={amt}
                onChange={(e) => setAmt(e.target.value.replace(/[^\d.]/g, ""))}
                placeholder={`Amount (${currency})`}
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
                disabled
                title="Fund your wallet with a verified payment first"
                onClick={() => setStep("confirm")}
                className="bg-brand flex w-full items-center justify-center gap-2 rounded-xl py-2.5 font-semibold text-primary-foreground disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Review
              </button>
            </>
          ) : (
            <>
              <p>
                Send <b>{formatCurrency(n, currency)}</b> to <b>{to}</b>?
              </p>
              <div className="flex gap-2">
                <button onClick={() => setStep("form")} className="flex-1 rounded-xl border py-2.5">
                  Back
                </button>
                <button
                  disabled
                  onClick={() => {
                    toast.error("Transfers require a verified wallet balance.");
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
          Transactions <span className="text-xs text-muted-foreground">(verified only)</span>
        </p>
        <ul className="divide-y">
          {liveTxns.map((t) => (
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
                {formatCurrency(t.amount, currency)}
              </p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}

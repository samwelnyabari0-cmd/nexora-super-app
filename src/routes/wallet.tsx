import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, Send, Globe } from "lucide-react";
import { DemoBadge, PageHeader, Panel } from "@/components/nexora/ui";
import { toast } from "sonner";
import { PaystackTopUp } from "@/components/nexora/PaystackTopUp";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

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
const SYMBOLS: Record<(typeof CURRENCIES)[number], string> = { USD: "$", EUR: "€", GBP: "£", KES: "KSh", NGN: "₦", ZAR: "R" };
const formatCurrency = (amount: number, currency: (typeof CURRENCIES)[number]) => `${SYMBOLS[currency]} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gatewayFor = (currency: (typeof CURRENCIES)[number]) => ["KES", "NGN", "ZAR"].includes(currency) ? "Paystack / Mobile Money" : "Coming soon — Stripe / international cards";

function WalletPage() {
  const { user } = useSession();
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("KES");
  const [walletRows, setWalletRows] = useState<Array<{
    id: string;
    kind: string;
    amount: number;
    label: string;
    created_at: string;
    currency: string;
  }>>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState("");

  useEffect(() => {
    let active = true;
    const loadWallet = async () => {
      if (!user) {
        if (active) {
          setWalletRows([]);
          setWalletLoading(false);
        }
        return;
      }

      setWalletLoading(true);
      const { data, error } = await (supabase as any)
        .from("wallet_txns")
        .select("id, kind, amount, label, created_at, currency")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .not("verified_at", "is", null)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (error) {
        console.error("Could not load verified wallet transactions:", error.message);
        setWalletError("Could not load your verified wallet balance. Please refresh.");
        setWalletRows([]);
      } else {
        setWalletError("");
        setWalletRows((data ?? []).map((row: any) => ({
          ...row,
          amount: Number(row.amount),
        })));
      }
      setWalletLoading(false);
    };

    void loadWallet();
    const refresh = () => void loadWallet();
    window.addEventListener("nexora:wallet-refresh", refresh);
    return () => {
      active = false;
      window.removeEventListener("nexora:wallet-refresh", refresh);
    };
  }, [user]);

  const balances = CURRENCIES.reduce((result, item) => {
    result[item] = walletRows
      .filter((row) => row.currency === item)
      .reduce((total, row) => total + (row.kind === "in" ? row.amount : -row.amount), 0);
    return result;
  }, {} as Record<(typeof CURRENCIES)[number], number>);
  const liveBalance = balances[currency] ?? 0;
  const liveTxns = walletRows.filter((row) => row.currency === currency);
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
    <div className="grid w-full min-w-0 grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="min-w-0 space-y-4">
        <PageHeader title="Wallet" action={<DemoBadge>Live ledger</DemoBadge>} />
        <Panel className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm font-semibold"><Globe className="h-4 w-4 text-cyan-400" /> Currency</label><select aria-label="Wallet currency" value={currency} onChange={(event) => setCurrency(event.target.value as (typeof CURRENCIES)[number])} className="rounded-xl border bg-background px-3 py-2 text-sm">{CURRENCIES.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
          <div className="grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-3">{CURRENCIES.map((item) => <button type="button" key={item} onClick={() => setCurrency(item)} className={`min-w-0 rounded-xl border p-2.5 text-left transition-colors hover:bg-muted sm:p-3 ${currency === item ? "border-primary bg-primary/10" : ""}`}><p className="text-xs text-muted-foreground">{item} balance</p><p className="mt-1 break-words text-sm font-semibold sm:text-base">{formatCurrency(balances[item] ?? 0, item)}</p></button>)}</div>
          <p className="text-xs text-muted-foreground">Gateway: {gatewayFor(currency)} · FX conversion fee estimate: 1.5%–2% shown before settlement.</p>
        </Panel>
        <div className="min-w-0 overflow-hidden rounded-3xl bg-brand p-5 text-primary-foreground shadow-glow sm:p-6">
          <p className="text-sm opacity-80">Available balance</p>
          <p className="break-words font-display text-3xl font-bold sm:text-4xl">{formatCurrency(liveBalance, currency)}</p>
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
      <Panel className="h-fit min-w-0 max-w-full overflow-hidden">
        <p className="mb-2 font-display font-semibold">
          Transactions <span className="text-xs text-muted-foreground">(verified only)</span>
        </p>
        <ul className="divide-y">
          {!walletLoading && liveTxns.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">No verified {currency} transactions yet.</li>}
          {liveTxns.map((t) => (
            <li key={t.id} className="flex min-w-0 items-center gap-2 py-3 sm:gap-3">
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
                <p className="text-xs text-muted-foreground">{new Date(t.created_at).toLocaleString()}</p>
              </div>
              <p
                className={
                  t.kind === "in" ? "max-w-[42%] break-words text-right text-xs font-semibold text-success sm:text-sm" : "max-w-[42%] break-words text-right text-xs font-semibold sm:text-sm"
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

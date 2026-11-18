import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Activity, ArrowDownLeft, ArrowUpRight, RefreshCw, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

export const Route = createFileRoute("/admin/finance")({
  head: () => ({
    meta: [
      { title: "Admin Finance — NEXORA" },
      { name: "description", content: "Platform wallet activity and verified payment totals." },
    ],
  }),
  component: AdminFinancePage,
});

type CurrencySummary = {
  currency: string;
  completed_in: number | string;
  completed_out: number | string;
  pending_amount: number | string;
  pending_count: number;
};

type WalletTransaction = {
  id: string;
  user_id: string;
  display_name: string;
  handle: string | null;
  amount: number | string;
  currency: string;
  kind: "in" | "out";
  label: string;
  payment_channel: string;
  gateway_reference: string | null;
  status: string;
  created_at: string;
  verified_at: string | null;
};

type FinanceData = {
  summary: CurrencySummary[];
  transactions: WalletTransaction[];
};

const money = (amount: number | string, currency: string) =>
  new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(amount) || 0);

function AdminFinancePage() {
  const { user, ready } = useSession();
  const [data, setData] = useState<FinanceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [denied, setDenied] = useState(false);

  const loadFinance = useCallback(async (silent = false) => {
    if (!user?.id) {
      setLoading(false);
      setData(null);
      return;
    }
    if (silent) setRefreshing(true);
    else setLoading(true);

    const { data: result, error } = await (supabase as any).rpc("admin_get_wallet_finance", {
      p_limit: 50,
      p_offset: 0,
    });

    if (error) {
      const isDenied = /administrator access required|permission denied|not authorized/i.test(error.message);
      setDenied(isDenied);
      if (!isDenied) toast.error("Could not load finance data.");
      setData(null);
    } else {
      setDenied(false);
      setData(result as unknown as FinanceData);
    }
    setLoading(false);
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => {
    if (ready) void loadFinance();
  }, [ready, loadFinance]);

  if (!ready || loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">Loading finance overview…</div>;
  }

  if (!user) {
    return (
      <Panel className="space-y-2">
        <ShieldCheck className="h-6 w-6 text-muted-foreground" />
        <h1 className="text-xl font-semibold">Administrator sign-in required</h1>
        <p className="text-sm text-muted-foreground">Sign in with an authorized Nexora administrator account to view platform finance.</p>
      </Panel>
    );
  }

  if (denied || !data) {
    return (
      <Panel className="space-y-2">
        <ShieldCheck className="h-6 w-6 text-destructive" />
        <h1 className="text-xl font-semibold">Access restricted</h1>
        <p className="text-sm text-muted-foreground">This page is only available to authorized Nexora platform administrators.</p>
      </Panel>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Finance"
        subtitle="Verified wallet activity across the Nexora platform"
        action={
          <Button variant="outline" size="sm" onClick={() => void loadFinance(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.summary.map((item) => (
          <Panel key={item.currency} className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">{item.currency} wallet flow</p>
              <Wallet className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Verified top-ups</p>
              <p className="text-2xl font-bold tabular-nums">{money(item.completed_in, item.currency)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t pt-3">
              <div>
                <p className="text-xs text-muted-foreground">Completed outflows</p>
                <p className="font-semibold tabular-nums">{money(item.completed_out, item.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="font-semibold tabular-nums">{money(item.pending_amount, item.currency)}</p>
                <p className="text-xs text-muted-foreground">{item.pending_count} transactions</p>
              </div>
            </div>
          </Panel>
        ))}
        {data.summary.length === 0 && (
          <Panel className="sm:col-span-2 xl:col-span-3">
            <p className="text-sm text-muted-foreground">No wallet activity has been recorded yet.</p>
          </Panel>
        )}
      </div>

      <Panel className="space-y-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-accent" />
          <div>
            <h2 className="font-semibold">Recent wallet transactions</h2>
            <p className="text-xs text-muted-foreground">Latest 50 transactions, newest first</p>
          </div>
        </div>

        {data.transactions.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No wallet transactions found.</p>
        ) : (
          <div className="divide-y">
            {data.transactions.map((tx) => (
              <div key={tx.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted">
                  {tx.kind === "in" ? <ArrowDownLeft className="h-5 w-5 text-success" /> : <ArrowUpRight className="h-5 w-5 text-muted-foreground" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{tx.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {tx.label} · {tx.payment_channel}{tx.handle ? ` · @${tx.handle}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">{new Date(tx.created_at).toLocaleString()}</p>
                  {tx.gateway_reference && (
                    <p className="truncate font-mono text-[10px] text-muted-foreground">Ref: {tx.gateway_reference}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-semibold tabular-nums">{tx.kind === "in" ? "+" : "−"}{money(tx.amount, tx.currency)}</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${tx.status === "completed" ? "bg-success/10 text-success" : tx.status === "pending" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground"}`}>
                    {tx.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
      <p className="text-xs text-muted-foreground">This view is read-only. Payment verification and wallet ledger changes remain server-controlled.</p>
    </div>
  );
}

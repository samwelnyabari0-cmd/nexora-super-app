import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Building2, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { onboardMerchantAccount } from "@/lib/paystack.functions";

export function MerchantOnboarding() {
  const onboard = useServerFn(onboardMerchantAccount);
  const [open, setOpen] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [settlementBank, setSettlementBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!businessName || !settlementBank || !accountNumber) return toast.error("Complete all payout fields");
    setBusy(true);
    try {
      const result = await onboard({ data: { businessName, settlementBank, accountNumber, platformFeePercentage: 3 } });
      if (result.success) { toast.success("Merchant payouts connected"); setOpen(false); }
      else toast.error(result.error ?? "Merchant onboarding failed");
    } catch { toast.error("Could not connect merchant payouts"); } finally { setBusy(false); }
  }
  return <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3"><div className="flex items-center justify-between gap-3"><p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4 text-blue-300" /> Merchant split payouts</p><Button type="button" size="sm" variant="outline" onClick={() => setOpen((value) => !value)}><Building2 className="mr-1 h-3.5 w-3.5" /> {open ? "Close" : "Connect payouts"}</Button></div>{open && <div className="mt-3 grid gap-2 sm:grid-cols-3"><Input aria-label="Business name" placeholder="Business name" value={businessName} onChange={(event) => setBusinessName(event.target.value)} /><Input aria-label="Settlement bank code" placeholder="Bank code" value={settlementBank} onChange={(event) => setSettlementBank(event.target.value)} /><Input aria-label="Bank account number" placeholder="Account number" value={accountNumber} onChange={(event) => setAccountNumber(event.target.value)} /><Button type="button" className="sm:col-span-3" disabled={busy} onClick={() => void submit()}>{busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create verified Paystack subaccount</Button></div>}<p className="mt-2 text-[11px] text-muted-foreground">Customer checkouts split automatically: the merchant receives 97% and Nexora retains a 3% platform fee.</p></div>;
}

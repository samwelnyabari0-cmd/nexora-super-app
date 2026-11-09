import { useState } from "react";
import { BadgeCheck, BriefcaseBusiness, CheckCircle2, DollarSign, FileText, LockKeyhole, Megaphone, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function BrandMarketplace() {
  const [showBrief, setShowBrief] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [slots, setSlots] = useState("1");

  function publishBrief() {
    const amount = Number(budget);
    const slotCount = Number(slots);
    if (title.trim().length < 3 || description.trim().length < 10 || !Number.isFinite(amount) || amount <= 0 || !Number.isInteger(slotCount) || slotCount < 1) {
      toast.error("Add a campaign brief, budget, and at least one creator slot");
      return;
    }
    toast.success("Campaign brief saved. Fund escrow to open creator applications.");
    setShowBrief(false);
  }

  return <section aria-labelledby="brand-marketplace" className="space-y-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">Nexora Brand Marketplace</p><h3 id="brand-marketplace" className="mt-1 text-base font-semibold">Sponsored campaigns, protected by escrow</h3><p className="mt-1 text-xs text-muted-foreground">Businesses publish briefs, creators apply, and funds release only after an approved sponsored post.</p></div><Megaphone className="h-5 w-5 text-cyan-300" /></div><div className="grid gap-2 sm:grid-cols-3"><div className="rounded-xl border bg-background/70 p-3"><BriefcaseBusiness className="mb-2 h-4 w-4 text-cyan-300" /><p className="text-sm font-semibold">Create brief</p><p className="mt-1 text-xs text-muted-foreground">Define deliverables, budget, and creator slots.</p></div><div className="rounded-xl border bg-background/70 p-3"><LockKeyhole className="mb-2 h-4 w-4 text-amber-300" /><p className="text-sm font-semibold">Secure escrow</p><p className="mt-1 text-xs text-muted-foreground">Funds stay protected until approval.</p></div><div className="rounded-xl border bg-background/70 p-3"><BadgeCheck className="mb-2 h-4 w-4 text-emerald-300" /><p className="text-sm font-semibold">Paid partnership</p><p className="mt-1 text-xs text-muted-foreground">Sponsored posts are disclosed automatically.</p></div></div><Button type="button" onClick={() => setShowBrief((value) => !value)}><FileText className="mr-2 h-4 w-4" />{showBrief ? "Close campaign brief" : "Create campaign brief"}</Button>{showBrief && <div className="grid gap-2 rounded-xl border bg-background/70 p-3"><Input aria-label="Campaign title" placeholder="Campaign title" value={title} onChange={(event) => setTitle(event.target.value)} /><Textarea aria-label="Campaign description" placeholder="Describe the sponsored video, review, or campaign deliverable" value={description} onChange={(event) => setDescription(event.target.value)} /><div className="grid gap-2 sm:grid-cols-2"><Input aria-label="Budget per creator" inputMode="decimal" placeholder="Budget per creator (KSh)" value={budget} onChange={(event) => setBudget(event.target.value.replace(/[^\d.]/g, ""))} /><Input aria-label="Creator slots" inputMode="numeric" placeholder="Creator slots" value={slots} onChange={(event) => setSlots(event.target.value.replace(/[^\d]/g, ""))} /></div><Button type="button" onClick={publishBrief}><Send className="mr-2 h-4 w-4" />Save brief</Button></div>}<div className="flex flex-wrap gap-x-4 gap-y-2 border-t pt-3 text-[11px] text-muted-foreground"><span className="flex items-center gap-1"><DollarSign className="h-3.5 w-3.5" />Creator receives 90%–95%</span><span className="flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Nexora fee: 5%–10%</span><span className="flex items-center gap-1"><CheckCircle2 className="h-3.5 w-3.5" />#Sponsored disclosure required</span></div></section>;
}

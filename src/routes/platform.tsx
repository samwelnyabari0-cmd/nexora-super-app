import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Server, Gauge, Calculator, Download, Trash2, Rocket } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, DemoBadge, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { fmtKES } from "@/features/core/data";
import {
  bus,
  feeSplit,
  perSecondCost,
  sponsoredPinCost,
  subscriptionEstimate,
  exportBundle,
} from "@/features/live/logic";
import { useLocal } from "@/features/live/useLocal";

export const Route = createFileRoute("/platform")({
  head: () => ({
    meta: [
      { title: "Platform — status, data & earnings estimates — NEXORA" },
      {
        name: "description",
        content:
          "Service status, low-bandwidth mode, earnings calculators and data export.",
      },
      { property: "og:title", content: "NEXORA Platform" },
      {
        property: "og:description",
        content: "Service status, data controls and earnings estimates.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PlatformPage,
});

// Customer-facing status only: no vendor names or setup hints are shown to users.
const ready = (ok: unknown) => (ok ? "Ready" : "Limited");
const services = [
  ["App & pages", "Running", "Online"],
  ["Accounts & sync", ready(import.meta.env.VITE_HAS_SUPABASE), ""],
  ["Live broadcasting", ready(import.meta.env.VITE_HAS_CLOUDFLARE), ""],
  ["Payments & tips", ready(import.meta.env.VITE_HAS_PAYSTACK), ""],
  ["AI co-host & assistant", ready(import.meta.env.VITE_HAS_AI), ""],
  ["Live maps", ready(import.meta.env.VITE_GOOGLE_MAPS_API_KEY), ""],
] as const;

const field = "w-full rounded-xl border bg-background px-3 py-2 text-sm";

function PlatformPage() {
  const [low, setLow] = useLocal("nx.lowBandwidth", false);
  const [onboarded, setOnboarded] = useLocal("nx.onboarded", false);
  const [fee, setFee] = useState(10);
  const [subs, setSubs] = useState(200);
  const [price, setPrice] = useState(150);
  const [secs, setSecs] = useState(600);
  const [rate, setRate] = useState(5);
  const [imp, setImp] = useState(10000);
  const [cpm, setCpm] = useState(150);

  useEffect(() => {
    document.documentElement.classList.toggle("low-bandwidth", low);
    bus.emit("bandwidth:change", { low });
  }, [low]);
  const sub = subscriptionEstimate(subs, price, fee);
  function exportData() {
    const data: Record<string, unknown> = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)!;
      if (k.startsWith("nx")) data[k] = localStorage.getItem(k);
    }
    const url = URL.createObjectURL(new Blob([exportBundle(data)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "nexora-data.json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function wipe() {
    if (!confirm("Delete all NEXORA data saved on this device?")) return;
    Object.keys(localStorage)
      .filter((k) => k.startsWith("nx"))
      .forEach((k) => localStorage.removeItem(k));
    toast.success("Local data deleted. Reload to start fresh.");
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Platform" subtitle="Status, data controls and earnings estimates" />
      {!onboarded && (
        <Panel className="space-y-2 border-primary/40">
          <h2 className="flex items-center gap-2 font-semibold">
            <Rocket className="h-4 w-4" />
            Welcome to NEXORA
          </h2>
          <ol className="list-decimal pl-5 text-sm text-muted-foreground">
            <li>Explore the feed and LIVE without signing in.</li>
            <li>Your data stays on this device unless you export it.</li>
            <li>Anything marked Demo is simulated.</li>
          </ol>
          <Button size="sm" onClick={() => setOnboarded(true)}>
            Got it
          </Button>
        </Panel>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Server className="h-4 w-4" />
            Service status
          </h2>
          <ul className="space-y-1 text-sm">
            {services.map(([n, s, d]) => (
              <li key={n} className="flex justify-between gap-2">
                <span>{n}</span>
                <span className={s === "Running" || s === "Ready" ? "text-success" : "text-muted-foreground"}>
                  {d ? `${s} · ${d}` : s}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Gauge className="h-4 w-4" />
            Low-bandwidth mode
          </h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={low} onChange={(e) => setLow(e.target.checked)} />
            Hide autoplay video & large images
          </label>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="h-4 w-4" />
              Export my data
            </Button>
            <Button variant="outline" size="sm" onClick={wipe}>
              <Trash2 className="h-4 w-4" />
              Clear device cache
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Data is saved only in this browser. No security certifications are claimed.
          </p>
        </Panel>
      </div>
      <Panel className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <Calculator className="h-4 w-4" />
          Earnings estimates <DemoBadge>Estimates, not guarantees</DemoBadge>
        </h2>
        <label className="block text-sm">
          Platform fee: {fee}%
          <input
            type="range"
            min={0}
            max={50}
            value={fee}
            onChange={(e) => setFee(+e.target.value)}
            className="w-full"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-3 text-sm">
          <div className="space-y-1">
            <b>Subscriptions</b>
            <input
              aria-label="Subscribers"
              type="number"
              className={field}
              value={subs}
              onChange={(e) => setSubs(+e.target.value)}
            />
            <input
              aria-label="Monthly price"
              type="number"
              className={field}
              value={price}
              onChange={(e) => setPrice(+e.target.value)}
            />
            <p>You keep {fmtKES(sub.creator)} / mo</p>
          </div>
          <div className="space-y-1">
            <b>Pay-per-second</b>
            <input
              aria-label="Seconds watched"
              type="number"
              className={field}
              value={secs}
              onChange={(e) => setSecs(+e.target.value)}
            />
            <input
              aria-label="KES per minute"
              type="number"
              className={field}
              value={rate}
              onChange={(e) => setRate(+e.target.value)}
            />
            <p>
              Viewer pays {fmtKES(perSecondCost(secs, rate))}; you keep{" "}
              {fmtKES(feeSplit(perSecondCost(secs, rate), fee).creator)}
            </p>
          </div>
          <div className="space-y-1">
            <b>Sponsored pin</b>
            <input
              aria-label="Impressions"
              type="number"
              className={field}
              value={imp}
              onChange={(e) => setImp(+e.target.value)}
            />
            <input
              aria-label="Cost per 1000"
              type="number"
              className={field}
              value={cpm}
              onChange={(e) => setCpm(+e.target.value)}
            />
            <p>Cost {fmtKES(sponsoredPinCost(imp, cpm))}</p>
          </div>
        </div>
      </Panel>
    </div>
  );
                                  }

import { createFileRoute } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Check, Crown, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { initSubscriptionPayment } from "@/lib/paystack.functions";
import { SUBSCRIPTION_PRODUCTS } from "@/lib/products";

export const Route = createFileRoute("/subscriptions")({
  head: () => ({
    meta: [
      { title: "Subscriptions — NEXORA" },
      { name: "description", content: "Choose the NEXORA plan that fits your viewing and creator workflow." },
    ],
  }),
  component: Subscriptions,
});

function Subscriptions() {
  const { user } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  async function subscribe(tier: "pro" | "studio") {
    if (!user) {
      toast.error("Sign in before choosing a subscription.");
      return;
    }
    setLoading(tier);
    const result = await initSubscriptionPayment({ data: { tier } });
    setLoading(null);
    if ("error" in result) {
      toast.error(result.error);
      return;
    }
    if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Choose your NEXORA tier" subtitle="Start free. Upgrade when your audience and workflow need more." />
      <Panel className="border-primary/20 bg-primary/[0.04]">
        <div className="flex items-start gap-3">
          <Crown className="mt-1 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />
          <div>
            <p className="font-semibold">Creator-first monetization</p>
            <p className="mt-1 text-sm text-muted-foreground">Keep publishing on Free, then unlock better distribution and lower platform cuts as you grow.</p>
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 md:grid-cols-3">
        <PlanCard name="Free" price="$0" description="For discovering NEXORA and sharing casually." highlights={["Short-form, photo and long-form viewing", "Casual uploads", "Targeted feed ads"]} action={<Button variant="outline" disabled>Current plan</Button>} />
        {SUBSCRIPTION_PRODUCTS.map((product) => (
          <PlanCard
            key={product.id}
            name={product.name.replace("NEXORA ", "")}
            price={`$${(product.priceInCents / 100).toFixed(2)}`}
            description={product.description}
            highlights={product.highlights}
            featured={product.id === "studio"}
            action={<Button onClick={() => subscribe(product.id)} disabled={loading !== null}>{loading === product.id ? "Opening checkout…" : `Choose ${product.name.replace("NEXORA ", "")}`}</Button>}
          />
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Subscriptions are processed securely by Paystack in KES, supporting cards, M-Pesa, and local payment methods.</p>
    </div>
  );
}

function PlanCard({ name, price, description, highlights, action, featured = false }: { name: string; price: string; description: string; highlights: string[]; action: ReactNode; featured?: boolean }) {
  return (
    <article className={`flex flex-col rounded-2xl border p-5 ${featured ? "border-accent bg-accent/[0.08] shadow-glow" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-2"><h2 className="font-display text-xl font-semibold">{name}</h2>{featured && <Sparkles className="h-5 w-5 text-accent" aria-label="Recommended" />}</div>
      <p className="mt-4 text-3xl font-semibold">{price}<span className="text-sm font-normal text-muted-foreground"> / month</span></p>
      <p className="mt-3 min-h-12 text-sm text-muted-foreground">{description}</p>
      <ul className="my-6 flex-1 space-y-3 text-sm">{highlights.map((highlight) => <li key={highlight} className="flex gap-2"><Check className="h-4 w-4 shrink-0 text-accent" aria-hidden="true" />{highlight}</li>)}</ul>
      {action}
    </article>
  );
}

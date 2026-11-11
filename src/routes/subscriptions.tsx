
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  Crown,
  Lock,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";
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
      {
        name: "description",
        content: "Compare NEXORA Free, Pro and Studio plans.",
      },
    ],
  }),
  component: Subscriptions,
});

const freeFeatures = [
  "Short-form, photo and long-form viewing",
  "Up to 5 Shorts and 10 posts per day",
  "Targeted feed ads",
  "Standard HD audio library",
];

const proFeatures = [
  "Ad-free viewing and background play",
  "Uploads up to 4GB at 1080p",
  "Full Pro music library",
  "Filter intensity sliders",
  "Video frame scrubber",
];

const studioFeatures = [
  "Deep analytics and audience demographics",
  "Priority feed distribution",
  "AI creator tools",
  "Advanced video trim timeline",
  "Voiceover and watermark overlays",
  "4K RTMP live streaming",
];

function Subscriptions() {
  const { user } = useSession();

  const [loading, setLoading] = useState<
    "pro" | "studio" | null
  >(null);

  async function subscribe(tier: "pro" | "studio") {
    if (!user) {
      toast.error("Sign in before choosing a subscription.");
      return;
    }

    setLoading(tier);

    try {
      const result = await initSubscriptionPayment({
        data: { tier },
      });

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.authorizationUrl) {
        window.location.assign(result.authorizationUrl);
      } else {
        toast.error("Checkout could not be opened.");
      }
    } catch {
      toast.error("Unable to start checkout. Please try again.");
    } finally {
      setLoading(null);
    }
  }

  const pro = SUBSCRIPTION_PRODUCTS.find(
    (product) => product.id === "pro"
  );

  const studio = SUBSCRIPTION_PRODUCTS.find(
    (product) => product.id === "studio"
  );

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">

      <PageHeader
        title="Upgrade your NEXORA experience"
        subtitle="Unlock more tools. Create more. Grow faster."
      />

      <Panel className="border-primary/20 bg-primary/[0.04]">
        <div className="flex items-start gap-3">
          <Crown className="mt-1 h-5 w-5 shrink-0 text-accent" />

          <div>
            <p className="font-semibold">
              Creator-first monetization
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              Start free and unlock better creator tools,
              analytics and lower platform cuts as you grow.
            </p>
          </div>
        </div>
      </Panel>

      <div className="grid items-stretch gap-4 lg:grid-cols-3">

        {/* FREE PLAN */}
        <PlanCard
          name="Free"
          price="$0"
          description="For discovering NEXORA and sharing casually."
          platformCut="20% platform cut"
          features={freeFeatures}
          current
          button={
            <Button className="w-full" variant="outline" disabled>
              Current plan
            </Button>
          }
        />

        {/* PRO PLAN */}
        {pro && (
          <PlanCard
            name="Pro"
            price={`$${(pro.priceInCents / 100).toFixed(2)}`}
            description="Ad-free viewing and better tools for growing creators."
            platformCut="10% platform cut"
            features={proFeatures}
            button={
              <Button
                className="w-full"
                onClick={() => void subscribe("pro")}
                disabled={loading !== null}
              >
                {loading === "pro"
                  ? "Opening checkout..."
                  : "Choose Pro"}

                {loading !== "pro" && (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            }
          />
        )}

        {/* STUDIO PLAN */}
        {studio && (
          <PlanCard
            name="Studio"
            price={`$${(studio.priceInCents / 100).toFixed(2)}`}
            description="Advanced monetization and analytics for professional creators."
            platformCut="5% platform cut"
            features={studioFeatures}
            featured
            button={
              <Button
                className="w-full"
                onClick={() => void subscribe("studio")}
                disabled={loading !== null}
              >
                {loading === "studio"
                  ? "Opening checkout..."
                  : "Choose Studio"}

                {loading !== "studio" && (
                  <ArrowRight className="ml-2 h-4 w-4" />
                )}
              </Button>
            }
          />
        )}

      </div>

      <div className="flex items-start justify-center gap-2 px-4 text-center text-xs text-muted-foreground">
        <Shield className="mt-0.5 h-4 w-4 shrink-0" />

        <p>
          Checkout is handled by Paystack. Available payment
          methods depend on your location and checkout options.
          Charges are displayed in KES.
        </p>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Subscription benefits are subject to account-level
        feature access and server-side enforcement.
      </p>

    </div>
  );
}

function PlanCard({
  name,
  price,
  description,
  platformCut,
  features,
  button,
  featured = false,
  current = false,
}: {
  name: string;
  price: string;
  description: string;
  platformCut: string;
  features: string[];
  button: React.ReactNode;
  featured?: boolean;
  current?: boolean;
}) {
  return (
    <article
      className={`relative flex h-full flex-col rounded-3xl border p-5 transition-colors ${
        featured
          ? "border-cyan-500/40 bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/40 shadow-lg shadow-cyan-950/20"
          : name === "Pro"
            ? "border-indigo-500/30 bg-card"
            : "border-border bg-card"
      }`}
    >

      {featured && (
        <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full border border-cyan-500/30 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-cyan-200">
          <Sparkles className="h-3 w-3" />
          Creator Plus
        </div>
      )}

      {name === "Pro" && (
        <div className="absolute right-4 top-4 rounded-full border border-indigo-500/30 bg-indigo-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-200">
          Popular
        </div>
      )}

      <div className="mb-3 pr-20">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold">
          {name}
          {featured && (
            <Sparkles className="h-4 w-4 text-cyan-400" />
          )}
        </h2>

        <p className="mt-3 text-3xl font-extrabold tracking-tight">
          {price}
          <span className="ml-1 text-xs font-normal text-muted-foreground">
            / month
          </span>
        </p>

        <p className="mt-2 min-h-10 text-sm text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2 text-xs font-semibold">
        <Zap className="h-3.5 w-3.5 text-accent" />
        {platformCut}
      </div>

      <ul className="mb-6 flex-1 space-y-3 border-t border-border/70 pt-4 text-sm">
        {features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-muted-foreground"
          >
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      {button}

      {current && (
        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground">
          <Lock className="h-3 w-3" />
          No payment required
        </p>
      )}

    </article>
  );
        }
      

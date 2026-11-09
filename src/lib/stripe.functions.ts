import Stripe from "stripe";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getSubscriptionProduct } from "@/lib/products";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("Stripe is not configured.");
  return new Stripe(secretKey);
}

export const startSubscriptionCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tier: z.enum(["pro", "studio"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const product = getSubscriptionProduct(data.tier);
    if (!product) return { error: "That subscription is not available." };

    try {
      const origin = getRequestHeader("origin") ?? "https://nexora-super-app.lovable.app";
      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [{
          price_data: {
            currency: "usd",
            unit_amount: product.priceInCents,
            recurring: { interval: product.interval },
            product_data: { name: product.name, description: product.description },
          },
          quantity: 1,
        }],
        client_reference_id: context.userId,
        metadata: { user_id: context.userId, tier: product.id, app: "nexora" },
        success_url: `${origin}/subscriptions?checkout=success&tier=${product.id}`,
        cancel_url: `${origin}/subscriptions?checkout=cancelled`,
      });
      return { url: session.url };
    } catch (error) {
      console.error("[Stripe] subscription checkout failed", error);
      return { error: error instanceof Error ? error.message : "Could not start checkout." };
    }
  });

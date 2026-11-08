export type SubscriptionTier = "free" | "pro" | "studio";

export interface SubscriptionProduct {
  id: SubscriptionTier;
  name: string;
  description: string;
  priceInCents: number;
  interval: "month";
  highlights: string[];
  platformCut: string;
}

export const SUBSCRIPTION_PRODUCTS: SubscriptionProduct[] = [
  {
    id: "pro",
    name: "NEXORA Pro",
    description: "Ad-free viewing and better tools for growing creators.",
    priceInCents: 999,
    interval: "month",
    highlights: ["Ad-free viewing", "Background play", "Expanded uploads", "10% platform cut"],
    platformCut: "10%",
  },
  {
    id: "studio",
    name: "NEXORA Studio",
    description: "Advanced monetization and analytics for professional creators.",
    priceInCents: 2499,
    interval: "month",
    highlights: ["Deep analytics", "Priority distribution", "AI creator tools", "5% platform cut"],
    platformCut: "5%",
  },
];

export function getSubscriptionProduct(id: string) {
  return SUBSCRIPTION_PRODUCTS.find((product) => product.id === id);
}

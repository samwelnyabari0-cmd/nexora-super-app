// Paystack calls stay server-side; the secret never reaches the browser.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PAYSTACK_URL = "https://api.paystack.co";

function gatewayHeaders() {
  const paystackKey = process.env["UDC_PAYSTACK_2_API_KEY"];
  if (!paystackKey) throw new Error("Paystack is not configured.");
  return {
    Authorization: `Bearer ${paystackKey}`,
    "Content-Type": "application/json",
  };
}

async function paystack(path: string, init?: RequestInit) {
  const res = await fetch(`${PAYSTACK_URL}${path}`, {
    ...init,
    headers: { ...gatewayHeaders(), ...init?.headers },
  });
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`Paystack request failed (HTTP ${res.status}).`);
  }
  const b = body as { status?: boolean; message?: string; data?: unknown };
  if (!res.ok || b.status !== true) {
    throw new Error(b.message ?? `Paystack error (HTTP ${res.status}).`);
  }
  return b;
}

export type TopUpInit = { authorizationUrl: string; reference: string };

export const initTopUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ amount: z.number().min(10).max(1_000_000) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const claims = context.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (!email) {
      return { error: "Sign in with Google first — Paystack needs an email account to charge." };
    }
    const origin = getRequestHeader("origin") ?? "https://nexora-super-app.lovable.app";
    const reference = `nx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const body = await paystack("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email,
          amount: Math.round(data.amount * 100),
          currency: "KES",
          reference,
          callback_url: `${origin}/wallet?paystack=return`,
          metadata: { user_id: context.userId, app: "nexora" },
        }),
      });
      const d = body.data as { authorization_url?: string; reference?: string };
      if (!d?.authorization_url) throw new Error("Paystack did not return a payment link.");
      return { authorizationUrl: d.authorization_url, reference: d.reference ?? reference };
    } catch (e) {
      console.error("[Paystack] initialize failed", e);
      return { error: e instanceof Error ? e.message : "Could not start the payment." };
    }
  });

export type CreatorPaymentKind = "tip" | "subscription" | "paywall" | "gift";

export const initCreatorPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    amount: z.number().min(10).max(1_000_000),
    creatorId: z.string().uuid(),
    kind: z.enum(["tip", "subscription", "paywall", "gift"]),
    tier: z.enum(["Starter", "Catalyst", "Pro", "VIP"]).default("Starter"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const claims = context.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (!email) return { error: "A verified email is required for payments." };
    const origin = getRequestHeader("origin") ?? "https://nexora-super-app.lovable.app";
    const reference = `nx-${data.kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const body = await paystack("/transaction/initialize", { method: "POST", body: JSON.stringify({
        email, amount: Math.round(data.amount * 100), currency: "KES", reference,
        callback_url: `${origin}/profile?payment=return`,
        metadata: { user_id: context.userId, creator_id: data.creatorId, kind: data.kind, tier: data.tier, app: "nexora" },
      }) });
      const d = body.data as { authorization_url?: string; reference?: string };
      if (!d?.authorization_url) throw new Error("Paystack did not return a payment link.");
      return { authorizationUrl: d.authorization_url, reference: d.reference ?? reference };
    } catch (e) {
      console.error("[Paystack] creator payment initialize failed", e);
      return { error: e instanceof Error ? e.message : "Could not start payment." };
    }
  });

export const verifyCreatorPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reference: z.string().min(3).max(140) }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const body = await paystack(`/transaction/verify/${encodeURIComponent(data.reference)}`);
      const tx = body.data as { status?: string; amount?: number; currency?: string; metadata?: Record<string, unknown> } | undefined;
      if (tx?.status !== "success") return { paid: false, error: `Payment status: ${tx?.status ?? "unknown"}.` };
      const meta = tx.metadata ?? {};
      if (meta.user_id !== context.userId || typeof meta.creator_id !== "string") return { paid: false, error: "Payment account verification failed." };
      if (tx.currency !== "KES") return { paid: false, error: "Unexpected payment currency." };
      const rpc = (context.supabase as any).rpc.bind(context.supabase);
      const { data: credit, error } = await rpc("process_creator_credit", {
        p_reference: data.reference, p_sender: context.userId, p_creator: meta.creator_id,
        p_gross: Number(tx.amount ?? 0) / 100, p_tier: meta.tier ?? "Starter",
        p_channel: "Paystack", p_transaction_type: meta.kind ?? "tip",
      });
      if (error) throw new Error(error.message);
      return { paid: true, credit };
    } catch (e) {
      console.error("[Paystack] creator payment verification failed", e);
      return { paid: false, error: e instanceof Error ? e.message : "Payment verification failed." };
    }
  });

export type TopUpVerify =
  | { paid: true; amount: number; recorded: boolean }
  | { paid: false; paystackStatus?: string; error?: string };

export const verifyTopUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().min(3).max(140) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const body = await paystack(`/transaction/verify/${encodeURIComponent(data.reference)}`);
      const tx = body.data as
        | { status?: string; amount?: number; currency?: string; metadata?: Record<string, unknown> }
        | undefined;
      if (tx?.status !== "success") {
        return { paid: false, paystackStatus: String(tx?.status ?? "unknown") } satisfies TopUpVerify;
      }
      if (tx.metadata?.user_id && tx.metadata.user_id !== context.userId) {
        return { paid: false, error: "This payment belongs to a different account." } satisfies TopUpVerify;
      }
      if (tx.currency !== "KES") {
        return { paid: false, error: `Unexpected payment currency: ${tx.currency}.` } satisfies TopUpVerify;
      }
      const amount = Number(tx.amount ?? 0) / 100;
      // Idempotent: never record the same reference twice.
      const { data: existing } = await context.supabase
        .from("wallet_txns")
        .select("id")
        .ilike("label", `%${data.reference}%`)
        .limit(1);
      if (existing?.length) return { paid: true, amount, recorded: false } satisfies TopUpVerify;
      const { error } = await context.supabase.from("wallet_txns").insert({
        user_id: context.userId,
        amount,
        kind: "in",
        label: `Paystack top-up · ${data.reference}`,
        note: "Card/mobile-money payment via Paystack",
      });
      if (error) {
        console.error("[Paystack] ledger insert failed", error);
        return { paid: true, amount, recorded: false } satisfies TopUpVerify;
      }
      return { paid: true, amount, recorded: true } satisfies TopUpVerify;
    } catch (e) {
      console.error("[Paystack] verify failed", e);
      return { paid: false, error: e instanceof Error ? e.message : "Verification failed." } satisfies TopUpVerify;
    }
  });

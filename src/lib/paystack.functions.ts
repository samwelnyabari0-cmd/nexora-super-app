// Real Paystack payments via the Lovable connector gateway (custom connector
// udc_paystack_2). All calls run server-side; credentials never reach the browser.
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/udc_paystack_2";

function gatewayHeaders() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const paystackKey = process.env["UDC_PAYSTACK_2_API_KEY"];
  if (!lovableKey || !paystackKey) {
    throw new Error("Paystack is not linked to this project yet. Connect it in Connectors.");
  }
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": paystackKey,
    "Content-Type": "application/json",
  };
}

async function paystack(path: string, init?: RequestInit) {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
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

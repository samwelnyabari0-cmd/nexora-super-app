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

const SUBSCRIPTION_USD_CENTS: Record<"pro" | "studio", number> = {
  pro: 999,
  studio: 2499,
};

async function getUsdToKesRate(): Promise<number> {
  const response = await fetch(
    "https://open.er-api.com/v6/latest/USD"
  );

  if (!response.ok) {
    throw new Error("Could not retrieve USD/KES exchange rate.");
  }

  const payload = await response.json() as {
    result?: string;
    rates?: { KES?: number };
  };

  const rate = Number(payload.rates?.KES);

  if (payload.result !== "success" || !Number.isFinite(rate) || rate <= 0) {
    throw new Error("USD/KES exchange rate unavailable.");
  }

  return rate;
}

export const initSubscriptionPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tier: z.enum(["pro", "studio"]) }).parse(input))
  .handler(async ({ data, context }) => {
    const claims = context.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (!email) return { error: "A verified email is required for subscriptions." };
    const origin = getRequestHeader("origin") ?? "https://nexora-super-app.lovable.app";
    const reference = `nx-sub-${data.tier}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    try {
      const exchangeRate = await getUsdToKesRate();
      const amountKobo = Math.round(
        (SUBSCRIPTION_USD_CENTS[data.tier] / 100) * exchangeRate * 100
      );

      const body = await paystack("/transaction/initialize", {
        method: "POST",
        body: JSON.stringify({
          email,
          amount: amountKobo,
          currency: "KES",
          reference,
          callback_url: `${origin}/subscriptions?paystack=return`,
          metadata: {
            user_id: context.userId,
            tier: data.tier,
            app: "nexora",
            kind: "subscription",
            amount_usd_cents: SUBSCRIPTION_USD_CENTS[data.tier],
            usd_to_kes_rate: exchangeRate,
            expected_amount_kobo: amountKobo,
          },
        }),
      });
      const d = body.data as { authorization_url?: string; reference?: string };
      if (!d?.authorization_url) throw new Error("Paystack did not return a payment link.");
      return { authorizationUrl: d.authorization_url, reference: d.reference ?? reference };
    } catch (error) {
      console.error("[Paystack] subscription initialize failed", error);
      return { error: error instanceof Error ? error.message : "Could not start the subscription payment." };
    }
  });

export const initTopUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
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

export type MerchantPaymentKind = "store_order" | "boosted_campaign";

export const onboardMerchantAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
    businessName: z.string().trim().min(2).max(255),
    settlementBank: z.string().trim().min(2).max(30),
    accountNumber: z.string().trim().min(4).max(50),
    platformFeePercentage: z.number().min(2).max(5).default(3),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const existing = await context.supabase.from("merchant_accounts").select("id").eq("business_id", context.userId).maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      const payload = await paystack("/subaccount", { method: "POST", body: JSON.stringify({ business_name: data.businessName, settlement_bank: data.settlementBank, account_number: data.accountNumber, percentage_charge: data.platformFeePercentage }) });
      const subaccountCode = (payload.data as { subaccount_code?: string } | undefined)?.subaccount_code;
      if (!subaccountCode) throw new Error("Paystack did not return a subaccount code.");
      const mutation = existing.data
        ? context.supabase.from("merchant_accounts").update({ business_name: data.businessName, paystack_subaccount_code: subaccountCode, platform_fee_percentage: data.platformFeePercentage, is_verified: true }).eq("business_id", context.userId)
        : context.supabase.from("merchant_accounts").insert({ business_id: context.userId, business_name: data.businessName, paystack_subaccount_code: subaccountCode, platform_fee_percentage: data.platformFeePercentage, is_verified: true });
      const { error } = await mutation;
      if (error) throw new Error(error.message);
      return { success: true, subaccountCode };
    } catch (error) {
      console.error("[Paystack] merchant onboarding failed", error);
      return { success: false, error: error instanceof Error ? error.message : "Could not connect merchant payouts." };
    }
  });

export const initializeStoreCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
    businessId: z.string().uuid(),
    orderReference: z.string().regex(/^nx-order-[a-z0-9-]+$/),
    amount: z.number().min(10).max(10_000_000),
    customerEmail: z.string().email(),
    kind: z.enum(["store_order", "boosted_campaign"]).default("store_order"),
  }).parse(input))
  .handler(async ({ data, context }) => {
    try {
      const { data: merchant, error } = await context.supabase.from("merchant_accounts").select("paystack_subaccount_code, platform_fee_percentage, is_verified").eq("business_id", data.businessId).maybeSingle();
      if (error) throw new Error(error.message);
      if (!merchant?.is_verified || !merchant.paystack_subaccount_code) return { success: false, error: "This business has not completed merchant onboarding." };
      const commission = Number(merchant.platform_fee_percentage ?? 3);
      const total = Math.round(data.amount * 100);
      const payload = await paystack("/transaction/initialize", { method: "POST", body: JSON.stringify({ email: data.customerEmail, amount: total, currency: "KES", reference: data.orderReference, subaccount: merchant.paystack_subaccount_code, transaction_charge: Math.round(total * commission / 100), metadata: { buyer_id: context.userId, business_id: data.businessId, kind: data.kind, commission_percentage: commission } }) });
      const authorizationUrl = (payload.data as { authorization_url?: string } | undefined)?.authorization_url;
      if (!authorizationUrl) throw new Error("Paystack did not return a checkout URL.");
      return { success: true, authorizationUrl };
    } catch (error) {
      console.error("[Paystack] store checkout failed", error);
      return { success: false, error: error instanceof Error ? error.message : "Could not start store checkout." };
    }
  });

export type CreatorPaymentKind = "tip" | "subscription" | "paywall" | "gift";

export const initCreatorPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({
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
  .validator((input: unknown) => z.object({ reference: z.string().min(3).max(140) }).parse(input))
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
  | { paid: true; amount: number; recorded: boolean; message?: string }
  | { paid: false; paystackStatus?: string; error?: string };

export const verifyTopUp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ reference: z.string().min(3).max(140) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const body = await paystack(`/transaction/verify/${encodeURIComponent(data.reference)}`);
      const tx = body.data as
        | { reference?: string; status?: string; amount?: number; currency?: string; metadata?: Record<string, unknown> }
        | undefined;
      if (tx?.status !== "success") {
        return { paid: false, paystackStatus: String(tx?.status ?? "unknown") } satisfies TopUpVerify;
      }
      if (tx.reference !== data.reference || tx.metadata?.user_id !== context.userId) {
        return { paid: false, error: "Payment reference or account verification failed." } satisfies TopUpVerify;
      }
      if (tx.currency !== "KES") {
        return { paid: false, error: `Unexpected payment currency: ${tx.currency}.` } satisfies TopUpVerify;
      }

      const amountKobo = Number(tx.amount);
      if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        return { paid: false, error: "Paystack returned an invalid payment amount." } satisfies TopUpVerify;
      }
      const amount = amountKobo / 100;
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;

      // The unique gateway reference makes retries safe without allowing users
      // to create their own wallet credits through the public Data API.
      const { data: existing, error: lookupError } = await admin
        .from("wallet_txns")
        .select("id, user_id, amount")
        .eq("gateway_reference", data.reference)
        .maybeSingle();

      if (lookupError) throw new Error(lookupError.message);
      if (existing) {
        if (existing.user_id !== context.userId || Number(existing.amount) !== amount) {
          return { paid: false, error: "This payment reference is already linked to a different ledger entry." } satisfies TopUpVerify;
        }
        return { paid: true, amount, recorded: false, message: "This payment was already recorded." } satisfies TopUpVerify;
      }

      const { error: insertError } = await admin.from("wallet_txns").insert({
        user_id: context.userId,
        amount,
        kind: "in",
        label: `Paystack top-up · ${data.reference}`,
        note: "Verified mobile-money/card payment via Paystack",
        gateway_reference: data.reference,
        currency: "KES",
        payment_channel: "Paystack",
        status: "completed",
        verified_at: new Date().toISOString(),
      });

      if (insertError) {
        console.error("[Paystack] verified top-up ledger insert failed", insertError);
        return {
          paid: true,
          amount,
          recorded: false,
          message: "Paystack verified the payment, but Nexora could not save it to the wallet ledger. Contact support with your reference.",
        } satisfies TopUpVerify;
      }

      return { paid: true, amount, recorded: true } satisfies TopUpVerify;
    } catch (e) {
      console.error("[Paystack] verify failed", e);
      return { paid: false, error: e instanceof Error ? e.message : "Verification failed." } satisfies TopUpVerify;
    }
  });


// New creator monetization flow: subscriptions priced in USD and charged in KES,
// plus one-time KES tips. All privileged database work stays server-side.
async function getAuditedUsdToKesRate(): Promise<{
  rate: number;
  source: string;
  timestamp: string;
}> {
  const response = await fetch("https://open.er-api.com/v6/latest/USD");
  if (!response.ok) throw new Error("Could not retrieve the USD/KES exchange rate.");

  const payload = await response.json() as {
    result?: string;
    rates?: { KES?: number };
    time_last_update_unix?: number;
  };
  const rate = Number(payload.rates?.KES);
  const unix = Number(payload.time_last_update_unix);

  if (
    payload.result !== "success" ||
    !Number.isFinite(rate) ||
    rate <= 0 ||
    !Number.isFinite(unix) ||
    unix <= 0
  ) {
    throw new Error("A valid USD/KES exchange rate is unavailable.");
  }

  const timestamp = new Date(unix * 1000);
  if (Date.now() - timestamp.getTime() > 48 * 60 * 60 * 1000) {
    throw new Error("The USD/KES exchange rate is too old. Please try again later.");
  }

  return {
    rate,
    source: "open.er-api.com",
    timestamp: timestamp.toISOString(),
  };
}

export const initCreatorMonetizationPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({
      creatorId: z.string().uuid(),
      kind: z.enum(["subscription", "tip"]),
      tipAmountKes: z.number().min(10).max(1_000_000).optional(),
    }).superRefine((value, ctx) => {
      if (value.kind === "tip" && value.tipAmountKes === undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a tip amount.",
          path: ["tipAmountKes"],
        });
      }
      if (value.kind === "subscription" && value.tipAmountKes !== undefined) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Subscription amount is set by the creator.",
          path: ["tipAmountKes"],
        });
      }
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const claims = context.claims as Record<string, unknown> | undefined;
    const email = typeof claims?.email === "string" ? claims.email : null;
    if (!email) return { error: "A verified email is required for payments." };
    if (data.creatorId === context.userId) {
      return { error: "You cannot pay yourself." };
    }

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;

      const [{ data: application, error: applicationError }, { data: verifiedKyc, error: kycError }] =
        await Promise.all([
          admin.from("creator_monetization_applications")
            .select("status")
            .eq("creator_id", data.creatorId)
            .maybeSingle(),
          admin.from("kyc_verifications")
            .select("id")
            .eq("user_id", data.creatorId)
            .eq("status", "verified")
            .limit(1)
            .maybeSingle(),
        ]);

      if (applicationError) throw new Error(applicationError.message);
      if (kycError) throw new Error(kycError.message);
      if (application?.status !== "approved" || !verifiedKyc) {
        return { error: "This creator is not yet eligible to receive payments." };
      }

      let amountKes: number;
      let amountUsd: number | null = null;
      let exchangeRate: number | null = null;
      let fxSource: string | null = null;
      let fxTimestamp: string | null = null;
      let tierName: string | null = null;

      if (data.kind === "subscription") {
        const { data: settings, error: settingsError } = await admin
          .from("creator_monetization_settings")
          .select("tier_name, monthly_price_usd, is_enabled")
          .eq("creator_id", data.creatorId)
          .maybeSingle();

        if (settingsError) throw new Error(settingsError.message);
        if (!settings?.is_enabled || Number(settings.monthly_price_usd) < 2) {
          return { error: "This creator has not enabled a subscription." };
        }

        const fx = await getAuditedUsdToKesRate();
        amountUsd = Number(settings.monthly_price_usd);
        exchangeRate = fx.rate;
        fxSource = fx.source;
        fxTimestamp = fx.timestamp;
        tierName = String(settings.tier_name);
        amountKes = Math.round(amountUsd * exchangeRate * 100) / 100;
      } else {
        amountKes = Number(data.tipAmountKes);
      }

      const amountKobo = Math.round(amountKes * 100);
      if (!Number.isSafeInteger(amountKobo) || amountKobo <= 0) {
        throw new Error("The payment amount is invalid.");
      }
      amountKes = amountKobo / 100;

      const reference = `nx-cmon-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
      const { data: payment, error: insertError } = await admin
        .from("creator_monetization_payments")
        .insert({
          transaction_reference: reference,
          subscriber_id: context.userId,
          creator_id: data.creatorId,
          payment_type: data.kind,
          amount_usd: amountUsd,
          amount_kes: amountKes,
          exchange_rate: exchangeRate,
          fx_source: fxSource,
          fx_timestamp: fxTimestamp,
          status: "pending",
          tier_name: tierName,
        })
        .select("id")
        .single();

      if (insertError || !payment) {
        throw new Error(insertError?.message ?? "Could not create the payment record.");
      }

      try {
        const origin = getRequestHeader("origin") ?? "https://nexora-super-app.lovable.app";
        const body = await paystack("/transaction/initialize", {
          method: "POST",
          body: JSON.stringify({
            email,
            amount: amountKobo,
            currency: "KES",
            reference,
            callback_url: `${origin}/profile?payment=return`,
            metadata: {
              app: "nexora",
              kind: "creator_monetization",
              payment_type: data.kind,
              payment_id: payment.id,
              transaction_reference: reference,
              subscriber_id: context.userId,
              creator_id: data.creatorId,
              tier_name: tierName,
              expected_amount_kobo: amountKobo,
            },
          }),
        });

        const gateway = body.data as { authorization_url?: string; reference?: string };
        if (!gateway?.authorization_url || gateway.reference !== reference) {
          throw new Error("Paystack did not return the expected payment reference.");
        }

        const { error: updateError } = await admin
          .from("creator_monetization_payments")
          .update({ gateway_reference: gateway.reference })
          .eq("id", payment.id)
          .eq("status", "pending");

        if (updateError) throw new Error(updateError.message);
        return {
          authorizationUrl: gateway.authorization_url,
          reference,
          amountKes,
          paymentType: data.kind,
        };
      } catch (gatewayError) {
        await admin.from("creator_monetization_payments")
          .update({ status: "failed" })
          .eq("id", payment.id)
          .eq("status", "pending");
        throw gatewayError;
      }
    } catch (error) {
      console.error("[Paystack] creator monetization initialize failed", error);
      return {
        error: error instanceof Error ? error.message : "Could not start creator payment.",
      };
    }
  });

export const verifyCreatorMonetizationPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) =>
    z.object({ reference: z.string().min(3).max(140) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const admin = supabaseAdmin as any;

      const { data: payment, error: paymentError } = await admin
        .from("creator_monetization_payments")
        .select("*")
        .eq("transaction_reference", data.reference)
        .maybeSingle();

      if (paymentError) throw new Error(paymentError.message);
      if (!payment || payment.subscriber_id !== context.userId) {
        return { paid: false, error: "Payment not found for this account." };
      }
      if (payment.status === "completed") return { paid: true, alreadyProcessed: true };
      if (payment.status !== "pending" || payment.gateway_reference !== data.reference) {
        return { paid: false, error: "This payment is not awaiting verification." };
      }

      const body = await paystack(
        `/transaction/verify/${encodeURIComponent(data.reference)}`,
      );
      const tx = body.data as {
        status?: string;
        reference?: string;
        amount?: number;
        currency?: string;
        metadata?: Record<string, unknown>;
      } | undefined;

      if (tx?.status !== "success") {
        return { paid: false, error: `Payment status: ${tx?.status ?? "unknown"}.` };
      }

      const metadata = tx.metadata ?? {};
      const verifiedKobo = Number(tx.amount);
      const expectedKobo = Math.round(Number(payment.amount_kes) * 100);

      if (
        tx.reference !== payment.gateway_reference ||
        tx.currency !== "KES" ||
        !Number.isSafeInteger(verifiedKobo) ||
        verifiedKobo !== expectedKobo ||
        metadata.app !== "nexora" ||
        metadata.kind !== "creator_monetization" ||
        metadata.payment_id !== payment.id ||
        metadata.transaction_reference !== payment.transaction_reference ||
        metadata.subscriber_id !== context.userId ||
        metadata.creator_id !== payment.creator_id
      ) {
        return { paid: false, error: "Payment verification details did not match." };
      }

      const { data: result, error: processError } = await admin.rpc(
        "process_creator_monetization_payment",
        {
          p_transaction_reference: payment.transaction_reference,
          p_gateway_reference: tx.reference,
          p_verified_amount_kes: verifiedKobo / 100,
        },
      );

      if (processError) throw new Error(processError.message);
      if (!result?.success) throw new Error("The payment could not be processed.");
      return {
        paid: true,
        alreadyProcessed: Boolean(result.already_processed),
        creatorAmountKes: result.creator_amount_kes ?? null,
      };
    } catch (error) {
      console.error("[Paystack] creator monetization verification failed", error);
      return {
        paid: false,
        error: error instanceof Error ? error.message : "Payment verification failed.",
      };
    }
  });

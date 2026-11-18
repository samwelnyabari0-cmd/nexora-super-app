
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API = "https://api.paystack.co";
const MAX_SIGNATURE_AGE_SECONDS = 300;

function safeHexEqual(expected: string, received: string): boolean {
  if (!/^[a-f0-9]+$/i.test(expected) || !/^[a-f0-9]+$/i.test(received)) {
    return false;
  }

  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(received, "hex");

  return a.length === b.length && timingSafeEqual(a, b);
}

function verifyWebhookSignature(
  rawBody: string,
  request: Request
): boolean {
  const signingSecret = process.env.PAYSTACK_WEBHOOK_SECRET;
  const apiSecret = process.env.UDC_PAYSTACK_2_API_KEY;

  const currentHeader = request.headers.get("paystack-signature");

  // Current Paystack webhook signature
  if (currentHeader && signingSecret) {
    // Paystack can include multiple v1 signatures during signing-secret rotation.
    // Preserve every v1 value rather than collapsing duplicate header fields.
    const headerParts = currentHeader.split(",").map((part) => part.trim());
    const timestampPart = headerParts.find((part) => part.startsWith("t="));
    const timestamp = Number(timestampPart?.slice(2));
    const signatures = headerParts
      .filter((part) => part.startsWith("v1="))
      .map((part) => {
        const value = part.slice(3);
        const separator = value.indexOf(":");
        return separator >= 0 ? value.slice(separator + 1) : value;
      });

    if (
      Number.isFinite(timestamp) &&
      Math.abs(Date.now() / 1000 - timestamp) <= MAX_SIGNATURE_AGE_SECONDS &&
      signatures.length > 0
    ) {
      const expected = createHmac("sha512", signingSecret)
        .update(`${timestamp}.${rawBody}`, "utf8")
        .digest("hex");

      if (
        signatures.some(
          (signature) =>
            /^[a-f0-9]{128}$/i.test(signature) &&
            safeHexEqual(expected, signature)
        )
      ) {
        return true;
      }
    }
  }

  // Legacy Paystack signature compatibility
  const legacyHeader = request.headers.get(
    "x-paystack-signature"
  );

  if (legacyHeader && apiSecret) {
    const expected = createHmac("sha512", apiSecret)
      .update(rawBody, "utf8")
      .digest("hex");

    if (safeHexEqual(expected, legacyHeader.trim())) {
      return true;
    }
  }

  return false;
}

type PaystackTransaction = {
  status?: string;
  reference?: string;
  amount?: number;
  currency?: string;
  metadata?: Record<string, unknown>;
};

export const Route = createFileRoute(
  "/api/paystack/webhook"
)({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Read raw body before parsing JSON
        const rawBody = await request.text();

        if (!verifyWebhookSignature(rawBody, request)) {
          return new Response(
            "Invalid Paystack signature",
            { status: 401 }
          );
        }

        let event: {
          event?: string;
          data?: {
            reference?: string;
            amount?: number;
            currency?: string;
          };
        };

        try {
          event = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", {
            status: 400,
          });
        }

        // Ignore unrelated events
        if (event.event !== "charge.success") {
          return Response.json({ received: true });
        }

        const reference = event.data?.reference;

        if (!reference || !reference.startsWith("nx-sub-")) {
          return Response.json({ received: true });
        }

        const paystackKey =
          process.env.UDC_PAYSTACK_2_API_KEY;

        if (!paystackKey) {
          console.error(
            "[Paystack] Missing API secret"
          );

          return new Response(
            "Payment verification is not configured",
            { status: 500 }
          );
        }

        try {
          // Verify transaction directly with Paystack
          const verifyResponse = await fetch(
            `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(reference)}`,
            {
              headers: {
                Authorization: `Bearer ${paystackKey}`,
              },
              cache: "no-store",
            }
          );

          if (!verifyResponse.ok) {
            return new Response(
              "Could not verify transaction",
              { status: 502 }
            );
          }

          const verifyPayload =
            await verifyResponse.json() as {
              status?: boolean;
              data?: PaystackTransaction;
            };

          const tx = verifyPayload.data;
          const metadata = tx?.metadata ?? {};

          const userId = metadata.user_id;
          const tier = metadata.tier;

          const expectedAmount = Number(
            metadata.expected_amount_kobo
          );

          const actualAmount = Number(tx?.amount);

          // Validate all transaction details
          if (
            verifyPayload.status !== true ||
            tx?.status !== "success" ||
            tx.reference !== reference ||
            tx.currency !== "KES" ||
            event.data?.currency !== "KES" ||
            Number(event.data?.amount) !== actualAmount ||
            metadata.app !== "nexora" ||
            metadata.kind !== "subscription" ||
            (tier !== "pro" && tier !== "studio") ||
            typeof userId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId) ||
            !Number.isSafeInteger(actualAmount) ||
            actualAmount <= 0 ||
            !Number.isSafeInteger(expectedAmount) ||
            expectedAmount !== actualAmount
          ) {
            console.error(
              "[Paystack] Transaction details did not match"
            );

            return new Response(
              "Transaction details did not match",
              { status: 400 }
            );
          }

          // Server-only Supabase service-role client
          const { supabaseAdmin } = await import(
            "@/integrations/supabase/client.server"
          );

          // Atomically record payment and activate subscription
          const { data: result, error: rpcError } =
            await (supabaseAdmin as any).rpc(
              "process_subscription_payment",
              {
                p_user_id: userId,
                p_reference: reference,
                p_tier: tier,
                p_amount_kobo: actualAmount,
              }
            );

          if (rpcError) {
            console.error(
              "[Paystack] Subscription activation failed",
              rpcError
            );

            return new Response(
              "Could not activate subscription",
              { status: 500 }
            );
          }

          // Keep paid-plan authorization in app_metadata, which users cannot edit.
          // Read the subscription row after the idempotent RPC so duplicate webhook
          // deliveries can safely re-sync the current authoritative expiry.
          const admin = supabaseAdmin as any;
          const [
            { data: authResult, error: getUserError },
            { data: subscription, error: subscriptionError },
          ] = await Promise.all([
            admin.auth.admin.getUserById(userId),
            admin
              .from("subscriptions")
              .select("tier, status, current_period_end")
              .eq("user_id", userId)
              .maybeSingle(),
          ]);

          if (getUserError || !authResult?.user) {
            console.error("[Paystack] Could not load account", getUserError);
            return new Response("Subscription activated; account sync pending", {
              status: 500,
            });
          }

          if (
            subscriptionError ||
            !subscription ||
            subscription.status !== "active" ||
            subscription.tier !== tier ||
            !Number.isFinite(Date.parse(subscription.current_period_end)) ||
            Date.parse(subscription.current_period_end) <= Date.now()
          ) {
            console.error(
              "[Paystack] Subscription record is missing or not active",
              subscriptionError
            );
            return new Response("Subscription record could not be confirmed", {
              status: 500,
            });
          }

          const existingAppMetadata = authResult.user.app_metadata ?? {};
          const accountTier = tier === "studio" ? "studio_vip" : "creator_pro";

          const { error: metadataError } = await admin.auth.admin.updateUserById(
            userId,
            {
              app_metadata: {
                ...existingAppMetadata,
                account_tier: accountTier,
                subscription_tier: tier,
                plan: tier,
                subscription_expires_at: subscription.current_period_end,
              },
            }
          );

          if (metadataError) {
            console.error("[Paystack] Account app metadata sync failed", metadataError);
            return new Response("Subscription activated; account sync pending", {
              status: 500,
            });
          }

          return Response.json({
            received: true,
            activated: true,
            tier,
            result,
          });

        } catch (error) {
          console.error(
            "[Paystack] Webhook processing error",
            error
          );

          return new Response(
            "Webhook processing failed",
            { status: 500 }
          );
        }
      },
    },
  },
});
                    

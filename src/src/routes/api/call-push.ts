import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "node:crypto";
import * as webpush from "web-push";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

function safeSecretEqual(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/call-push")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: {
          callId?: string;
          callerId?: string;
          calleeId?: string;
          kind?: "audio" | "video";
        };
        try {
          payload = await request.json();
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        const { callId, callerId, calleeId, kind } = payload;
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!callId || !uuid.test(callId) || !callerId || !uuid.test(callerId) ||
            !calleeId || !uuid.test(calleeId) || (kind !== "audio" && kind !== "video")) {
          return new Response("Invalid call event", { status: 400 });
        }

        const publicKey = process.env.VAPID_PUBLIC_KEY;
        const privateKey = process.env.VAPID_PRIVATE_KEY;
        if (!publicKey || !privateKey) {
          return new Response("Call push delivery is not configured", { status: 503 });
        }

        const { data: expected, error: secretError } = await (supabaseAdmin as any)
          .rpc("get_nexora_call_push_secret");
        const received = request.headers.get("x-nexora-call-secret") ?? "";
        if (secretError || typeof expected !== "string" || !safeSecretEqual(expected, received)) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { data: call, error: callError } = await supabaseAdmin
          .from("call_invites")
          .select("id, caller, callee, kind, status")
          .eq("id", callId)
          .eq("caller", callerId)
          .eq("callee", calleeId)
          .eq("status", "ringing")
          .maybeSingle();
        if (callError || !call) return Response.json({ sent: 0, stale: true });

        const [{ data: caller }, { data: subscriptions, error: subscriptionsError }] = await Promise.all([
          supabaseAdmin.from("profiles").select("display_name, handle").eq("id", callerId).maybeSingle(),
          supabaseAdmin.from("push_subscriptions").select("endpoint, subscription").eq("user_id", calleeId),
        ]);
        if (subscriptionsError) {
          console.error("[NEXORA call push] Subscription lookup failed", subscriptionsError);
          return new Response("Could not load notification subscriptions", { status: 500 });
        }
        if (!subscriptions?.length) return Response.json({ sent: 0, noSubscription: true });

        webpush.setVapidDetails(
          process.env.VAPID_SUBJECT ?? "mailto:notifications@nexora.app",
          publicKey,
          privateKey,
        );
        const callerName = caller?.display_name || (caller?.handle ? `@${caller.handle}` : "A NEXORA contact");
        const title = kind === "video" ? "Incoming video call" : "Incoming voice call";
        const body = `${callerName} is calling you`;
        let sent = 0;
        const expired: string[] = [];
        await Promise.all(subscriptions.map(async (row) => {
          try {
            await webpush.sendNotification(
              row.subscription as webpush.PushSubscription,
              JSON.stringify({ type: "incoming-call", callId, title, body, url: "/calls" }),
              { TTL: 60, urgency: "high" },
            );
            sent += 1;
          } catch (error) {
            const statusCode = (error as { statusCode?: number }).statusCode;
            if (statusCode === 404 || statusCode === 410) expired.push(row.endpoint);
            else console.warn("[NEXORA call push] Delivery failed", statusCode ?? error);
          }
        }));
        if (expired.length) {
          await supabaseAdmin.from("push_subscriptions").delete().in("endpoint", expired);
        }
        return Response.json({ sent, expired: expired.length });
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import postgres from "postgres";
import * as webpush from "web-push";
import { z } from "zod";

const subscriptionSchema = z.object({
  endpoint: z.string().url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

let tableReady: Promise<void> | undefined;

async function ensureTable() {
  if (!tableReady) {
    const sql = postgres(process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? "", {
      max: 1,
      prepare: false,
    });
    tableReady = sql`
      create table if not exists push_subscriptions (
        endpoint text primary key,
        subscription jsonb not null,
        updated_at timestamptz not null default now()
      )
    `.then(() => sql.end({ timeout: 1 })).then(() => undefined);
  }
  return tableReady;
}

export const savePushSubscription = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => subscriptionSchema.parse(value))
  .handler(async ({ data }) => {
    if (!process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
      return { error: "Push persistence is not configured." };
    }
    await ensureTable();
    const sql = postgres(process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL!, {
      prepare: false,
    });
    await sql`
      insert into push_subscriptions (endpoint, subscription)
      values (${data.endpoint}, ${JSON.stringify(data)})
      on conflict (endpoint) do update set subscription = excluded.subscription, updated_at = now()
    `;
    await sql.end({ timeout: 1 });
    return { ok: true };
  });

export const sendPushNotification = createServerFn({ method: "POST" })
  .inputValidator((value: unknown) => z.object({ endpoint: z.string().url(), title: z.string().min(1).max(120), body: z.string().min(1).max(500) }).parse(value))
  .handler(async ({ data }) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    const subject = process.env.VAPID_SUBJECT ?? "mailto:notifications@nexora.app";
    if (!publicKey || !privateKey) return { error: "Push delivery is not configured." };
    webpush.setVapidDetails(subject, publicKey, privateKey);
    const sql = postgres(process.env.POSTGRES_URL ?? process.env.POSTGRES_PRISMA_URL ?? "", { prepare: false });
    const rows = await sql<{ subscription: unknown }[]>`select subscription from push_subscriptions where endpoint = ${data.endpoint}`;
    await sql.end({ timeout: 1 });
    const subscription = rows[0]?.subscription;
    if (!subscription) return { error: "Push subscription was not found." };
    await webpush.sendNotification(subscription as webpush.PushSubscription, JSON.stringify({ title: data.title, body: data.body }));
    return { ok: true };
  });

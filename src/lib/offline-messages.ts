import {
  enqueueOfflineMessage,
  getQueuedMessages,
  removeQueuedMessage,
  type OfflineMessageKind,
} from "@/lib/offline-storage";

type SupabaseLike = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { code?: string; message?: string } | null }>;
  };
};

export function isLikelyNetworkFailure(error: unknown): boolean {
  if (typeof navigator !== "undefined" && !navigator.onLine) return true;
  const message = error && typeof error === "object" && "message" in error
    ? String((error as { message?: unknown }).message ?? "")
    : String(error ?? "");
  return /network|fetch|connection|timeout|load failed|offline|failed to send/i.test(message);
}

export async function queueTextMessage(input: {
  ownerId: string;
  kind: OfflineMessageKind;
  conversationId: string;
  body: string;
  id?: string;
}): Promise<string> {
  const id = input.id ?? crypto.randomUUID();
  await enqueueOfflineMessage({
    id,
    ownerId: input.ownerId,
    kind: input.kind,
    conversationId: input.conversationId,
    body: input.body,
  });
  return id;
}

export async function flushOfflineMessages(
  client: SupabaseLike,
  ownerId: string,
  kind: OfflineMessageKind,
  conversationId: string,
): Promise<{ sent: number; error?: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return { sent: 0 };
  const pending = await getQueuedMessages(ownerId, kind, conversationId);
  let sent = 0;
  const table = kind === "direct" ? "direct_messages" : "chat_group_messages";

  for (const item of pending) {
    const row = kind === "direct"
      ? { client_request_id: item.id, sender_id: ownerId, recipient_id: conversationId, body: item.body }
      : { client_request_id: item.id, group_id: conversationId, sender_id: ownerId, body: item.body };

    const { error } = await client.from(table).insert(row);
    if (error && error.code !== "23505") {
      return { sent, error: error.message || "Message could not be synced." };
    }

    await removeQueuedMessage(item.id);
    sent += 1;
  }

  return { sent };
}

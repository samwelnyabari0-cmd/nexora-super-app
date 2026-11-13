
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};

type RecipientProfile = {
  display_name: string | null;
  handle: string;
  avatar_url: string | null;
};

export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    recipient:
      typeof search.recipient === "string" ? search.recipient : "",
    returnTo:
      typeof search.returnTo === "string" &&
      search.returnTo.startsWith("/profile")
        ? search.returnTo
        : "/profile",
  }),
  head: () => ({
    meta: [{ title: "Messages — NEXORA" }],
  }),
  component: Messages,
});

function Messages() {
  const { recipient, returnTo } = Route.useSearch();
  const { user, ready } = useSession();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [profile, setProfile] = useState<RecipientProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);

  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadChat() {
      if (!ready) return;

      if (!user) {
        setLoading(false);
        return;
      }

      if (!recipient || recipient === user.id) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      const [sentResult, receivedResult, profileResult] =
        await Promise.all([
          (supabase as any)
            .from("direct_messages")
            .select("id, sender_id, recipient_id, body, created_at")
            .eq("sender_id", user.id)
            .eq("recipient_id", recipient)
            .order("created_at", { ascending: true }),

          (supabase as any)
            .from("direct_messages")
            .select("id, sender_id, recipient_id, body, created_at")
            .eq("sender_id", recipient)
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: true }),

          (supabase as any)
            .from("profiles")
            .select("display_name, handle, avatar_url")
            .eq("id", recipient)
            .maybeSingle(),
        ]);

      if (cancelled) return;

      if (sentResult.error || receivedResult.error) {
        setError("Could not load this conversation. Please try again.");
        setMessages([]);
      } else {
        const combined = [
          ...(sentResult.data ?? []),
          ...(receivedResult.data ?? []),
        ] as DirectMessage[];

        combined.sort(
          (a, b) =>
            new Date(a.created_at).getTime() -
            new Date(b.created_at).getTime()
        );

        setMessages(combined);
      }

      setProfile(profileResult.data ?? null);
      setLoading(false);
    }

    void loadChat();

    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, recipient, refresh]);

  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();

    if (!body || !user || !recipient || sending) return;

    if (recipient === user.id) {
      setError("You cannot message your own account.");
      return;
    }

    setSending(true);
    setError("");

    const { error: sendError } = await (supabase as any)
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        recipient_id: recipient,
        body,
      });

    setSending(false);

    if (sendError) {
      setError("Message could not be sent. Please try again.");
      return;
    }

    setDraft("");
    setRefresh((value) => value + 1);
  }

  if (!ready) {
    return <div className="p-8 text-center">Checking your account...</div>;
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">Sign in to send messages</h1>
        <Button asChild>
          <a href="/auth">Sign in</a>
        </Button>
      </div>
    );
  }

  if (!recipient || recipient === user.id) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-8 text-center">
        <h1 className="text-xl font-bold">No conversation selected</h1>
        <p className="text-sm text-muted-foreground">
          Open someone's public profile and select Message to start a
          conversation.
        </p>
        <Button asChild>
          <a href="/profile">My profile</a>
        </Button>
      </div>
    );
  }

  const recipientName = profile?.display_name || "NEXORA User";

  return (
    <main className="mx-auto flex h-[85dvh] min-h-[500px] max-w-3xl flex-col p-3 sm:p-4">
      <header className="flex items-center gap-3 border-b pb-4">
        <Button variant="ghost" size="icon" asChild>
          <a href={returnTo} aria-label="Back to profile">
            <ArrowLeft />
          </a>
        </Button>

        {profile?.avatar_url ? (
          <img
            src={profile.avatar_url}
            alt=""
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 font-bold">
            {recipientName.charAt(0).toUpperCase()}
          </div>
        )}

        <div className="min-w-0">
          <h1 className="truncate font-semibold">{recipientName}</h1>
          <p className="text-xs text-muted-foreground">
            {profile?.handle ? `@${profile.handle}` : "Direct conversation"}
          </p>
        </div>
      </header>

      <div
        ref={log}
        className="flex-1 space-y-3 overflow-y-auto py-4"
        aria-live="polite"
        role="log"
      >
        {loading ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            Loading messages...
          </p>
        ) : error && messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-destructive">
            {error}
          </p>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Send the first message.
          </p>
        ) : (
          messages.map((message) => {
            const mine = message.sender_id === user.id;

            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] break-words rounded-2xl px-4 py-2 ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">
                    {message.body}
                  </p>
                  <p className="mt-1 text-right text-[10px] opacity-70">
                    {new Date(message.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && messages.length > 0 && (
        <p className="pb-2 text-sm text-destructive">{error}</p>
      )}

      <form onSubmit={sendMessage} className="flex gap-2 border-t pt-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Write a message..."
          maxLength={2000}
          aria-label="Write a message"
          className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />

        <Button
          type="submit"
          size="icon"
          aria-label="Send message"
          disabled={!draft.trim() || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
          }

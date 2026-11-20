
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ImagePlus, X, Mic, Square, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { CreateGroupDialog } from "@/components/nexora/CreateGroupDialog";
import { GroupChat } from "@/components/nexora/GroupChat";
import { formatMessageTime, getMessageDateLabel, shouldShowDateDivider } from "@/components/nexora/message-format";
import { VoiceNotePlayer } from "@/components/nexora/VoiceNotePlayer";

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  media_path?: string | null;
  media_type?: "image" | "video" | "audio" | null;
  delivered_at?: string | null;
  seen_at?: string | null;
  created_at: string;
};

type RecipientProfile = {
  display_name: string | null;
  handle: string;
  avatar_url: string | null;
};
type InboxConversation = {
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
};
type GroupInboxConversation = {
  groupId: string;
  name: string;
  avatarUrl: string | null;
  lastMessage: string;
  lastMessageAt: string;
};
export const Route = createFileRoute("/messages")({
  validateSearch: (search: Record<string, unknown>) => ({
    recipient:
      typeof search.recipient === "string" ? search.recipient : "",
    group: typeof search.group === "string" ? search.group : "",
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
  const { recipient, group, returnTo } = Route.useSearch();
  const { user, ready } = useSession();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [groupInbox, setGroupInbox] = useState<GroupInboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "groups">("all");
  const [profile, setProfile] = useState<RecipientProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const fileInput = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [recipientPresence, setRecipientPresence] = useState<{
    show_online: boolean;
    show_last_seen: boolean;
    last_seen: string | null;
  } | null>(null);

  const log = useRef<HTMLDivElement>(null);

  // Presence is returned only for people who have exchanged direct messages.
  useEffect(() => {
    if (!user?.id || !recipient || recipient === user.id) {
      setRecipientPresence(null);
      return;
    }

    let cancelled = false;
    const loadPresence = async () => {
      const { data, error } = await (supabase as any).rpc(
        "get_chat_presence_status",
        { p_user_id: recipient }
      );

      if (cancelled) return;
      if (error) {
        setRecipientPresence(null);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setRecipientPresence(
        row
          ? {
              show_online: row.show_online ?? true,
              show_last_seen: row.show_last_seen ?? true,
              last_seen: row.last_seen ?? null,
            }
          : null
      );
    };

    void loadPresence();
    const interval = window.setInterval(() => void loadPresence(), 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user?.id, recipient]);

  const recipientIsOnline =
    !!recipientPresence?.show_online &&
    !!recipientPresence.last_seen &&
    Date.now() - new Date(recipientPresence.last_seen).getTime() < 90000;

  const recipientStatus = recipientIsOnline
    ? "Online"
    : recipientPresence?.show_last_seen && recipientPresence.last_seen
      ? `Last seen ${new Date(recipientPresence.last_seen).toLocaleString()}`
      : "Offline";

  useEffect(() => {
    let cancelled = false;

    async function loadChat() {
      if (!ready) return;

      if (!user) {
        setLoading(false);
        return;
      }

      if (group) {
        setLoading(false);
        return;
      }

      if (!recipient) {
  setInboxLoading(true);

  const { data, error: inboxError } = await (supabase as any)
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, media_path, media_type, delivered_at, seen_at, created_at")
    .order("created_at", { ascending: false });

  if (cancelled) return;

  if (inboxError) {
    setError("Could not load your conversations.");
    setInbox([]);
  } else {
    const receivedUndelivered = ((data ?? []) as DirectMessage[])
      .filter(
        (message) =>
          message.recipient_id === user.id && !message.delivered_at
      )
      .map((message) => message.id);

    if (receivedUndelivered.length > 0) {
      const deliveredTime = new Date().toISOString();
      await (supabase as any)
        .from("direct_messages")
        .update({ delivered_at: deliveredTime })
        .in("id", receivedUndelivered);
    }

    const latestByUser = new Map<string, DirectMessage>();
    const unreadByUser = new Map<string, number>();

    for (const message of (data ?? []) as DirectMessage[]) {
      const otherUser =
        message.sender_id === user.id
          ? message.recipient_id
          : message.sender_id;

      if (otherUser !== user.id && !latestByUser.has(otherUser)) {
        latestByUser.set(otherUser, message);
      }
      if (message.recipient_id === user.id && !message.seen_at) {
        unreadByUser.set(otherUser, (unreadByUser.get(otherUser) ?? 0) + 1);
      }
    }

    const conversations = await Promise.all(
      Array.from(latestByUser.entries()).map(async ([userId, message]) => {
        const { data: profileData } = await (supabase as any)
          .rpc("get_chat_recipient_profile", { p_user_id: userId });

        const profile = Array.isArray(profileData)
          ? profileData[0]
          : profileData;

        return {
          userId,
          displayName: profile?.display_name || "NEXORA User",
          handle: profile?.handle || "",
          avatarUrl: profile?.avatar_url || null,
          lastMessage: message.body || (message.media_type === "video" ? "🎥 Video" : message.media_type === "image" ? "📷 Photo" : message.media_type === "audio" ? "🎤 Voice message" : ""),
          lastMessageAt: message.created_at,
          unreadCount: unreadByUser.get(userId) ?? 0,
        };
      })
    );

    if (!cancelled) setInbox(conversations);
  }

  // Load groups where the signed-in user is currently a member.
  const { data: memberships, error: membershipError } = await (supabase as any)
    .from("chat_group_members")
    .select("group_id")
    .eq("user_id", user.id);

  if (!cancelled) {
    if (membershipError || !memberships?.length) {
      setGroupInbox([]);
    } else {
      const groupIds = [...new Set(memberships.map((row: { group_id: string }) => row.group_id))];
      const [{ data: groups }, { data: groupMessages }] = await Promise.all([
        (supabase as any)
          .from("chat_groups")
          .select("id, name, avatar_url, created_at")
          .in("id", groupIds),
        (supabase as any)
          .from("chat_group_messages")
          .select("id, group_id, body, media_type, created_at")
          .in("group_id", groupIds)
          .order("created_at", { ascending: false }),
      ]);

      const latestByGroup = new Map<string, any>();
      for (const message of groupMessages ?? []) {
        if (!latestByGroup.has(message.group_id)) {
          latestByGroup.set(message.group_id, message);
        }
      }

      const groupRows = await Promise.all((groups ?? []).map(async (item: any) => {
        const latest = latestByGroup.get(item.id);
        let signedAvatar: string | null = null;
        if (item.avatar_url) {
          const { data: signed } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(item.avatar_url, 3600);
          signedAvatar = signed?.signedUrl ?? null;
        }
        return {
          groupId: item.id,
          name: item.name,
          avatarUrl: signedAvatar,
          lastMessage: latest?.body || (
            latest?.media_type === "video" ? "🎥 Video" :
            latest?.media_type === "image" ? "📷 Photo" :
            latest?.media_type === "audio" ? "🎤 Voice message" :
            "No messages yet"
          ),
          lastMessageAt: latest?.created_at || item.created_at,
        } as GroupInboxConversation;
      }));
      if (!cancelled) setGroupInbox(groupRows);
    }
  }

  setInboxLoading(false);
  setLoading(false);
  return;
}

if (recipient === user.id) {
  setLoading(false);
  return;
}

      setLoading(true);
      setError("");

      const [sentResult, receivedResult, profileResult] =
        await Promise.all([
          (supabase as any)
            .from("direct_messages")
            .select("id, sender_id, recipient_id, body, media_path, media_type, delivered_at, seen_at, created_at")
            .eq("sender_id", user.id)
            .eq("recipient_id", recipient)
            .order("created_at", { ascending: true }),

          (supabase as any)
            .from("direct_messages")
            .select("id, sender_id, recipient_id, body, media_path, media_type, delivered_at, seen_at, created_at")
            .eq("sender_id", recipient)
            .eq("recipient_id", user.id)
            .order("created_at", { ascending: true }),

          (supabase as any)
  .rpc("get_chat_recipient_profile", {
    p_user_id: recipient,
  })
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

        const incomingMessages = combined.filter(
          (message) => message.sender_id === recipient && message.recipient_id === user.id
        );
        if (incomingMessages.length > 0) {
          const receiptTime = new Date().toISOString();
          const undeliveredIds = incomingMessages
            .filter((message) => !message.delivered_at)
            .map((message) => message.id);
          const unseenIds = incomingMessages
            .filter((message) => !message.seen_at)
            .map((message) => message.id);

          if (undeliveredIds.length > 0) {
            await (supabase as any)
              .from("direct_messages")
              .update({ delivered_at: receiptTime })
              .in("id", undeliveredIds);
          }
          if (unseenIds.length > 0) {
            await (supabase as any)
              .from("direct_messages")
              .update({ seen_at: receiptTime })
              .in("id", unseenIds);
          }

          const incomingIds = new Set(incomingMessages.map((message) => message.id));
          setMessages(
            combined.map((message) =>
              incomingIds.has(message.id)
                ? {
                    ...message,
                    delivered_at: message.delivered_at || receiptTime,
                    seen_at: message.seen_at || receiptTime,
                  }
                : message
            )
          );
        } else {
          setMessages(combined);
        }
      }

      setProfile(profileResult.data ?? null);
      setLoading(false);
    }

    void loadChat();

    return () => {
      cancelled = true;
    };
  }, [ready, user?.id, recipient, group, refresh]);

  useEffect(() => {
    if (!user?.id || !recipient) return;

    const channel = supabase
      .channel(`message-receipts-${user.id}-${recipient}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "direct_messages",
          filter: `recipient_id=eq.${recipient}`,
        },
        (payload) => {
          const updated = payload.new as DirectMessage;
          setMessages((current) =>
            current.map((message) =>
              message.id === updated.id
                ? {
                    ...message,
                    delivered_at: updated.delivered_at,
                    seen_at: updated.seen_at,
                  }
                : message
            )
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, recipient]);

  useEffect(() => {
    if (!user?.id || recipient || group) return;

    const channel = supabase
      .channel(`group-inbox-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_group_messages",
        },
        () => setRefresh((value) => value + 1),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_group_members",
          filter: `user_id=eq.${user.id}`,
        },
        () => setRefresh((value) => value + 1),
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, recipient, group]);

  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadMediaUrls() {
      const mediaMessages = messages.filter((message) => message.media_path);
      const entries = await Promise.all(
        mediaMessages.map(async (message) => {
          const { data } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(message.media_path!, 3600);
          return [message.id, data?.signedUrl || ""] as const;
        })
      );

      if (!cancelled) {
        setMediaUrls((current) => ({
          ...current,
          ...Object.fromEntries(entries.filter(([, url]) => Boolean(url))),
        }));
      }
    }

    void loadMediaUrls();
    return () => {
      cancelled = true;
    };
  }, [messages]);

  async function startVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording is not supported in this browser.");
      return;
    }

    try {
      setError("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordingStreamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      recorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };

      recorder.onerror = () => {
        setError("Voice recording failed. Please try again.");
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setRecording(false);
      };

      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || "audio/webm";
        const extension = type.includes("mp4") ? "m4a" : "webm";
        const blob = new Blob(recordingChunksRef.current, { type });
        if (blob.size > 0) {
          setSelectedFile(new File([blob], `voice-message.${extension}`, { type }));
          if (fileInput.current) fileInput.current.value = "";
        } else {
          setError("No audio was recorded. Please try again.");
        }
        stream.getTracks().forEach((track) => track.stop());
        recordingStreamRef.current = null;
        setRecording(false);
      };

      recorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access was denied or unavailable.");
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordingStreamRef.current = null;
      setRecording(false);
    }
  }

  function stopVoiceRecording() {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const body = draft.trim();
    const attachment = selectedFile;

    if ((!body && !attachment) || !user || !recipient || sending) return;

    if (recipient === user.id) {
      setError("You cannot message your own account.");
      return;
    }

    setSending(true);
    setError("");

    let mediaPath: string | null = null;
    let mediaType: "image" | "video" | "audio" | null = null;

    if (attachment) {
      const isImage = attachment.type.startsWith("image/");
      const isVideo = attachment.type.startsWith("video/");
      const isAudio = attachment.type.startsWith("audio/");
      if (!isImage && !isVideo && !isAudio) {
        setError("Choose an image, video, or audio file.");
        setSending(false);
        return;
      }
      if (attachment.size > 50 * 1024 * 1024) {
        setError("The file must be 50 MB or smaller.");
        setSending(false);
        return;
      }

      mediaType = isImage ? "image" : isVideo ? "video" : "audio";
      const extension = attachment.name.split(".").pop()?.toLowerCase() || (isImage ? "jpg" : isVideo ? "mp4" : "webm");
      mediaPath = `${user.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(mediaPath, attachment, {
          contentType: attachment.type,
          upsert: false,
        });

      if (uploadError) {
        setError("Media upload failed. Please try again.");
        setSending(false);
        return;
      }
    }

    const { error: sendError } = await (supabase as any)
      .from("direct_messages")
      .insert({
        sender_id: user.id,
        recipient_id: recipient,
        body,
        media_path: mediaPath,
        media_type: mediaType,
      });

    if (sendError) {
      if (mediaPath) {
        await supabase.storage.from("chat-media").remove([mediaPath]);
      }
      setError("Message could not be sent. Please try again.");
      setSending(false);
      return;
    }

    setDraft("");
    setSelectedFile(null);
    if (fileInput.current) fileInput.current.value = "";
    setSending(false);
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
if (group) {
  return (
    <GroupChat
      groupId={group}
      userId={user.id}
      onBack={() => { window.location.href = "/messages"; }}
    />
  );
}

if (!recipient && !group) {
  const combinedInbox = [
    ...groupInbox.map((item) => ({ kind: "group" as const, ...item })),
    ...inbox.map((item) => ({
      kind: "direct" as const,
      userId: item.userId,
      displayName: item.displayName,
      handle: item.handle,
      avatarUrl: item.avatarUrl,
      lastMessage: item.lastMessage,
      lastMessageAt: item.lastMessageAt,
      unreadCount: item.unreadCount,
    })),
  ].sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());

  const normalizedSearch = inboxSearch.trim().toLowerCase();
  const visibleInbox = combinedInbox.filter((conversation) => {
    const isGroup = conversation.kind === "group";
    if (inboxFilter === "groups" && !isGroup) return false;
    if (inboxFilter === "unread" && (isGroup || conversation.unreadCount === 0)) return false;
    if (!normalizedSearch) return true;
    return [isGroup ? conversation.name : conversation.displayName, !isGroup ? conversation.handle : "", conversation.lastMessage]
      .join(" ").toLowerCase().includes(normalizedSearch);
  });

  return (
    <main className="mx-auto max-w-2xl p-4">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Messages</h1>
        <CreateGroupDialog
          userId={user.id}
          onCreated={(groupId) => {
            window.location.href = `/messages?group=${encodeURIComponent(groupId)}`;
          }}
        />
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={inboxSearch} onChange={(event) => setInboxSearch(event.target.value)} placeholder="Search messages" aria-label="Search conversations" className="w-full rounded-xl border bg-background py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-primary" />
        </div>
        <div className="flex gap-2" role="group" aria-label="Filter conversations">
          {([["all", "All"], ["unread", "Unread"], ["groups", "Groups"]] as const).map(([value, label]) => (
            <button key={value} type="button" onClick={() => setInboxFilter(value)} aria-pressed={inboxFilter === value} className={`rounded-full px-4 py-2 text-xs font-semibold transition ${inboxFilter === value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>{label}</button>
          ))}
        </div>
      </div>
      {inboxLoading ? (
        <p className="py-10 text-center text-muted-foreground">
          Loading conversations...
        </p>
      ) : error && inbox.length === 0 && groupInbox.length === 0 ? (
        <p className="py-10 text-center text-destructive">{error}</p>
      ) : combinedInbox.length === 0 ? (
        <div className="py-12 text-center">
          <h2 className="font-semibold">No conversations yet</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Visit someone's public profile and tap Message to start chatting.
          </p>
          <Button asChild className="mt-4">
            <a href="/explore">Explore people</a>
          </Button>
        </div>
      ) : (
        <div className="divide-y">
          {visibleInbox.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No conversations match this search or filter.</p>
          ) : visibleInbox.map((conversation) => {
            const isGroup = conversation.kind === "group";
            const title = isGroup ? conversation.name : conversation.displayName;
            const href = isGroup
              ? `/messages?group=${encodeURIComponent(conversation.groupId)}`
              : `/messages?recipient=${encodeURIComponent(conversation.userId)}`;
            return (
              <a
                key={isGroup ? `group-${conversation.groupId}` : `direct-${conversation.userId}`}
                href={href}
                className="flex items-center gap-3 py-4 hover:bg-muted/50"
              >
                {conversation.avatarUrl ? (
                  <img
                    src={conversation.avatarUrl}
                    alt=""
                    className={`h-12 w-12 object-cover ${isGroup ? "rounded-2xl" : "rounded-full"}`}
                  />
                ) : (
                  <div className={`flex h-12 w-12 items-center justify-center bg-primary/15 font-bold ${isGroup ? "rounded-2xl" : "rounded-full"}`}>
                    {title.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {conversation.lastMessage}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-[11px] text-muted-foreground">{formatMessageTime(conversation.lastMessageAt)}</span>
                  {!isGroup && conversation.unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground" aria-label={`${conversation.unreadCount} unread messages`}>{conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}</span>
                  )}
                </div>
              </a>
            );
          })}
        </div>
      )}
    </main>
  );
}

if (recipient === user.id) {
  return (
    <div className="p-8 text-center">
      Invalid conversation.
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
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {recipientIsOnline && (
              <span className="h-2 w-2 rounded-full bg-green-500" aria-label="Online" />
            )}
            <span>{recipientStatus}</span>
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
          messages.map((message, index) => {
            const mine = message.sender_id === user.id;
            const showDateDivider = shouldShowDateDivider(message.created_at, messages[index - 1]?.created_at);

            return (
              <div key={message.id} className="space-y-2">
                {showDateDivider && (
                  <div className="sticky top-1 z-10 flex justify-center py-1">
                    <span className="rounded-full border bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">{getMessageDateLabel(message.created_at)}</span>
                  </div>
                )}
                <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] break-words rounded-2xl px-4 py-2 ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted"
                  }`}
                >
                  {message.media_path && mediaUrls[message.id] && (
                    message.media_type === "video" ? (
                      <video
                        src={mediaUrls[message.id]}
                        controls
                        playsInline
                        className="mb-2 max-h-72 max-w-full rounded-lg"
                      />
                    ) : message.media_type === "audio" ? (
                      <VoiceNotePlayer src={mediaUrls[message.id]} mine={mine} />
                    ) : (
                      <img
                        src={mediaUrls[message.id]}
                        alt="Shared photo"
                        className="mb-2 max-h-72 max-w-full rounded-lg object-contain"
                      />
                    )
                  )}
                  {message.body && (
                    <p className="whitespace-pre-wrap text-sm">
                      {message.body}
                    </p>
                  )}
                  <p className="mt-1 flex items-center justify-end gap-1 text-[10px] opacity-70">
                    <span>{formatMessageTime(message.created_at)}</span>
                    {mine && (
                      <span
                        className={message.seen_at ? "font-semibold text-sky-300" : ""}
                        aria-label={
                          message.seen_at
                            ? "Seen"
                            : message.delivered_at
                              ? "Delivered"
                              : "Sent"
                        }
                      >
                        {message.seen_at ? "✓✓" : message.delivered_at ? "✓✓" : "✓"}
                      </span>
                    )}
                  </p>
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {error && messages.length > 0 && (
        <p className="pb-2 text-sm text-destructive">{error}</p>
      )}

      {selectedFile && (
        <div className="flex items-center justify-between gap-2 border-t px-2 py-2 text-sm">
          <span className="min-w-0 truncate">📎 {selectedFile.name}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Remove attachment"
            onClick={() => {
              setSelectedFile(null);
              if (fileInput.current) fileInput.current.value = "";
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t pt-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav"
          className="hidden"
          aria-label="Choose a photo or video"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            if (file) setSelectedFile(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Attach photo or video"
          disabled={sending}
          onClick={() => fileInput.current?.click()}
        >
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={recording ? "Stop voice recording" : "Record voice message"}
          disabled={sending}
          onClick={recording ? stopVoiceRecording : startVoiceRecording}
        >
          {recording ? (
            <Square className="h-4 w-4" />
          ) : (
            <Mic className="h-4 w-4" />
          )}
        </Button>
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
          disabled={(!draft.trim() && !selectedFile) || sending || recording}
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </main>
  );
          }

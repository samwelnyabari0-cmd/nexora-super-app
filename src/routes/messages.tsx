
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, ImagePlus, X, Mic, Square, Search, MapPin, Radio, Share2, Phone, Video, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { CreateGroupDialog } from "@/components/nexora/CreateGroupDialog";
import { GroupChat } from "@/components/nexora/GroupChat";
import { formatMessageTime, getMessageDateLabel, shouldShowDateDivider } from "@/components/nexora/message-format";
import { VoiceNotePlayer } from "@/components/nexora/VoiceNotePlayer";
import { useChatActivity } from "@/hooks/useChatActivity";
import { MessageReactions, type MessageReaction, type MessageReactionEmoji } from "@/components/nexora/MessageReactions";
import { MessageAttachment } from "@/components/nexora/MessageAttachment";
import { resolveChatAttachment, safeAttachmentName, uploadThenInsertAttachment } from "@/components/nexora/message-attachments";
import { LocationShareCard } from "@/components/nexora/LocationShareCard";
import { useChatLocationSharing } from "@/hooks/useChatLocationSharing";
import type { ChatLocationPayload } from "@/components/nexora/location-sharing";
import { ShareContentDialog } from "@/components/nexora/ShareContentDialog";
import { SharedContentCard } from "@/components/nexora/SharedContentCard";
import { sharedContentLabel, type SharedContentReference } from "@/components/nexora/shared-content";
import { DisappearingSettingsControl } from "@/components/nexora/DisappearingSettingsControl";
import { isMessageExpired, messageExpiryDelay } from "@/components/nexora/message-expiry";
import { buildSmartReplyPrompt, parseSmartReplySuggestions } from "@/components/nexora/smart-replies";
import { aiChat } from "@/lib/ai.functions";
import { ChatLockPanel } from "@/components/nexora/ChatLockPanel";
import { hasStoredChatLock } from "@/components/nexora/chat-lock";
import { useChatLock } from "@/hooks/useChatLock";

type DirectMessage = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  media_path?: string | null;
  media_type?: "image" | "video" | "audio" | "document" | null;
  attachment_name?: string | null;
  attachment_mime_type?: string | null;
  attachment_size_bytes?: number | null;
  location_latitude?: number | null;
  location_longitude?: number | null;
  location_accuracy_m?: number | null;
  location_captured_at?: string | null;
  location_session_id?: string | null;
  shared_content_source?: "posts" | "user_media_posts" | null;
  shared_content_id?: string | null;
  shared_content_type?: "post" | "reel" | "video" | null;
  expires_at?: string | null;
  delivered_at?: string | null;
  seen_at?: string | null;
  created_at: string;
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
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
  isOnline: boolean;
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
  const navigate = useNavigate();
  const { recipient, group, returnTo } = Route.useSearch();
  const { user, ready } = useSession();
  const chatLock = useChatLock(user?.id ?? "", "direct", recipient);

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [replyTarget, setReplyTarget] = useState<DirectMessage | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const touchStartX = useRef<number | null>(null);
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [groupInbox, setGroupInbox] = useState<GroupInboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxSearch, setInboxSearch] = useState("");
  const [inboxFilter, setInboxFilter] = useState<"all" | "unread" | "groups">("all");
  const [profile, setProfile] = useState<RecipientProfile | null>(null);
  const [draft, setDraft] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draftExpanded, setDraftExpanded] = useState(false);
  const [shareContentOpen, setShareContentOpen] = useState(false);
  const [startingCall, setStartingCall] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [smartRepliesLoading, setSmartRepliesLoading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const timers = messages.flatMap((message) => {
      const delay = messageExpiryDelay(message.expires_at);
      if (delay === null) return [];
      if (delay === 0 || isMessageExpired(message.expires_at)) {
        setMessages((current) => current.filter((item) => item.id !== message.id));
        setMediaUrls((current) => {
          const next = { ...current };
          delete next[message.id];
          return next;
        });
        return [];
      }
      return [window.setTimeout(() => {
        setMessages((current) => current.filter((item) => item.id !== message.id));
        setMediaUrls((current) => {
          const next = { ...current };
          delete next[message.id];
          return next;
        });
      }, delay + 25)];
    });
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [messages]);
  const visibleMessages = messages.filter((message) => !isMessageExpired(message.expires_at));
  useEffect(() => {
    if (chatLock.status === "unlocked") return;
    setMessages([]);
    setReactions([]);
    setReplyTarget(null);
    setMediaUrls({});
    setProfile(null);
    setRecipientPresence(null);
    setSmartReplies([]);
  }, [chatLock.status]);
  useEffect(() => {
    if (replyTarget && isMessageExpired(replyTarget.expires_at)) setReplyTarget(null);
  }, [replyTarget]);
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
  const directActivityTopic = user?.id && recipient
    ? `dm:${[user.id, recipient].sort().join(":")}`
    : "";
  const { remoteActivity, publishActivity } = useChatActivity({
    topic: directActivityTopic,
    userId: user?.id ?? "",
    enabled: Boolean(user?.id && recipient && !group && chatLock.status === "unlocked"),
  });
  const locationSharing = useChatLocationSharing({
    chatKind: "direct",
    chatId: recipient,
    userId: user?.id ?? "",
    enabled: Boolean(user?.id && recipient && !group && chatLock.status === "unlocked"),
    onShareOnce: async (payload: ChatLocationPayload) => {
      if (!user?.id || !recipient) return false;
      const { error: insertError } = await (supabase as any).from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: recipient,
        body: "Shared a location",
        location_latitude: payload.latitude,
        location_longitude: payload.longitude,
        location_accuracy_m: payload.accuracyM,
        location_captured_at: payload.capturedAt,
      });
      if (!insertError) setRefresh((value) => value + 1);
      return !insertError;
    },
    onLiveSession: async (sessionId: string) => {
      if (!user?.id || !recipient) return false;
      const { error: insertError } = await (supabase as any).from("direct_messages").insert({
        sender_id: user.id,
        recipient_id: recipient,
        body: "Started live location sharing",
        location_session_id: sessionId,
      });
      if (!insertError) setRefresh((value) => value + 1);
      return !insertError;
    },
  });

  useEffect(() => {
    publishActivity(recording ? "recording" : draft.trim() ? "typing" : null);
  }, [draft, recording, publishActivity]);

  // Presence is returned only for people who have exchanged direct messages.
  useEffect(() => {
    if (!user?.id || !recipient || recipient === user.id || chatLock.status !== "unlocked") {
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
  }, [user?.id, recipient, chatLock.status]);

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

      if (recipient && chatLock.status !== "unlocked") {
        setLoading(chatLock.status === "checking");
        return;
      }

      if (!recipient) {
  setInboxLoading(true);

  const { data, error: inboxError } = await (supabase as any)
    .from("direct_messages")
    .select("id, sender_id, recipient_id, body, media_path, media_type, delivered_at, seen_at, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type, expires_at, edited_at, deleted_at")
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
        const { data: presenceData } = await (supabase as any).rpc(
          "get_chat_presence_status",
          { p_user_id: userId },
        );
        const presence = Array.isArray(presenceData) ? presenceData[0] : presenceData;
        const isOnline = Boolean(
          presence?.show_online && presence?.last_seen &&
          Date.now() - new Date(presence.last_seen).getTime() < 90000
        );

        return {
          userId,
          displayName: profile?.display_name || "NEXORA User",
          handle: profile?.handle || "",
          avatarUrl: profile?.avatar_url || null,
          lastMessage: hasStoredChatLock(user.id, "direct", userId) ? "🔒 Locked chat" : message.deleted_at ? "This message was deleted" : message.body || (message.media_type === "video" ? "🎥 Video" : message.media_type === "image" ? "📷 Photo" : message.media_type === "audio" ? "🎤 Voice message" : message.media_type === "document" ? "📄 Document" : ""),
          lastMessageAt: message.created_at,
          unreadCount: unreadByUser.get(userId) ?? 0,
          isOnline,
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
          .select("id, group_id, body, media_type, created_at, location_latitude, location_session_id, deleted_at")
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
          lastMessage: hasStoredChatLock(user.id, "group", item.id) ? "🔒 Locked group" : latest?.deleted_at ? "This message was deleted" : latest?.body || (
            latest?.media_type === "video" ? "🎥 Video" :
            latest?.media_type === "image" ? "📷 Photo" :
            latest?.media_type === "audio" ? "🎤 Voice message" :
            latest?.media_type === "document" ? "📄 Document" :
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
            .select("id, sender_id, recipient_id, body, media_path, media_type, delivered_at, seen_at, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type, expires_at, edited_at, deleted_at")
            .eq("sender_id", user.id)
            .eq("recipient_id", recipient)
            .order("created_at", { ascending: true }),

          (supabase as any)
            .from("direct_messages")
            .select("id, sender_id, recipient_id, body, media_path, media_type, delivered_at, seen_at, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type, expires_at, edited_at, deleted_at")
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
  }, [ready, user?.id, recipient, group, refresh, chatLock.status]);

  useEffect(() => {
    if (!user?.id || !recipient || chatLock.status !== "unlocked") return;

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
  }, [user?.id, recipient, chatLock.status]);

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
    if (messages.length === 0) {
      setReactions([]);
      return;
    }
    let cancelled = false;
    const ids = messages.map((message) => message.id);
    void (supabase as any).from("direct_message_reactions")
      .select("message_id, user_id, emoji")
      .in("message_id", ids)
      .then(({ data, error }: { data: MessageReaction[] | null; error: unknown }) => {
        if (!cancelled && !error) setReactions(data ?? []);
      });
    return () => { cancelled = true; };
  }, [messages]);

  useEffect(() => {
    if (!recipient || !user?.id || chatLock.status !== "unlocked") return;
    const channel = supabase.channel(`direct-reactions-${user.id}-${recipient}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "direct_message_reactions" }, async () => {
        const ids = messages.map((message) => message.id);
        if (ids.length === 0) return;
        const { data } = await (supabase as any).from("direct_message_reactions")
          .select("message_id, user_id, emoji").in("message_id", ids);
        setReactions(data ?? []);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [recipient, user?.id, messages, chatLock.status]);

  async function editMessage(message: DirectMessage) {
    const nextBody = window.prompt("Edit your message", message.body);
    if (nextBody === null || !nextBody.trim() || nextBody.trim() === message.body) return;
    const { data, error: editError } = await (supabase as any).rpc("edit_direct_message", {
      p_message_id: message.id,
      p_body: nextBody.trim(),
    });
    if (editError) { setError(editError.message || "Your message could not be edited."); return; }
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, body: nextBody.trim(), edited_at: data } : item));
  }

  async function deleteMessage(message: DirectMessage) {
    if (!window.confirm("Delete this message for everyone in the conversation?")) return;
    const { data, error: deleteError } = await (supabase as any).rpc("delete_direct_message", { p_message_id: message.id });
    if (deleteError) { setError(deleteError.message || "Your message could not be deleted."); return; }
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, body: "", media_path: null, media_type: null, attachment_name: null, attachment_mime_type: null, attachment_size_bytes: null, location_latitude: null, location_longitude: null, location_accuracy_m: null, location_captured_at: null, location_session_id: null, shared_content_source: null, shared_content_id: null, shared_content_type: null, deleted_at: data } : item));
    setMediaUrls((current) => { const next = { ...current }; delete next[message.id]; return next; });
  }

  async function toggleReaction(messageId: string, emoji: MessageReactionEmoji) {
    if (!user) return;
    const existing = reactions.find((item) => item.message_id === messageId && item.user_id === user.id);
    let result;
    if (existing?.emoji === emoji) {
      result = await (supabase as any).from("direct_message_reactions")
        .delete().eq("message_id", messageId).eq("user_id", user.id);
    } else if (existing) {
      result = await (supabase as any).from("direct_message_reactions")
        .update({ emoji }).eq("message_id", messageId).eq("user_id", user.id);
    } else {
      result = await (supabase as any).from("direct_message_reactions")
        .insert({ message_id: messageId, user_id: user.id, emoji });
    }
    if (result.error) { setError("Your reaction could not be saved."); return; }
    setReactions((current) => [
      ...current.filter((item) => !(item.message_id === messageId && item.user_id === user.id)),
      ...(existing?.emoji === emoji ? [] : [{ message_id: messageId, user_id: user.id, emoji }]),
    ]);
  }

  useEffect(() => {
    const node = log.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [messages]);

  useEffect(() => {
    let cancelled = false;

    async function loadMediaUrls() {
      const mediaMessages = messages.filter((message) => message.media_path && !isMessageExpired(message.expires_at));
      const entries = await Promise.all(
        mediaMessages.map(async (message) => {
          const { data } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(message.media_path!, 60);
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
    const refreshTimer = window.setInterval(() => void loadMediaUrls(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
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

  async function startDirectCall(kind: "audio" | "video") {
    if (!user?.id || !recipient || group || startingCall) return;
    setStartingCall(true);
    setError("");
    try {
      const { error: callError } = await supabase
        .from("call_invites")
        .insert({ caller: user.id, callee: recipient, kind });
      if (callError) {
        setError("Calls are available only with accepted contacts. Add this person as a contact in Calls first.");
        return;
      }
      await navigate({ to: "/calls" });
    } finally {
      setStartingCall(false);
    }
  }

  async function suggestSmartReplies() {
    if (!user?.id || smartRepliesLoading) return;
    const prompt = buildSmartReplyPrompt(
      messages
        .filter((message) => !isMessageExpired(message.expires_at))
        .map((message) => ({
          sender: message.sender_id === user.id ? "You" as const : "Them" as const,
          body: message.body ?? "",
          media_path: message.media_path ?? null,
          media_type: message.media_type ?? null,
          location_latitude: message.location_latitude ?? null,
          location_longitude: message.location_longitude ?? null,
          location_session_id: message.location_session_id ?? null,
          shared_content_id: message.shared_content_id ?? null,
        })),
    );
    if (!prompt) {
      setError("There is no recent text to use for reply suggestions.");
      return;
    }
    setSmartRepliesLoading(true);
    setError("");
    try {
      const result = await aiChat({ data: { messages: [{ role: "user", content: prompt }] } });
      if (result.error) {
        setError(result.error);
        setSmartReplies([]);
      } else {
        const suggestions = parseSmartReplySuggestions(result.text);
        setSmartReplies(suggestions);
        if (!suggestions.length) setError("No reply suggestions were returned. Please try again.");
      }
    } catch {
      setError("AI reply suggestions are unavailable right now.");
      setSmartReplies([]);
    } finally {
      setSmartRepliesLoading(false);
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
    let mediaType: "image" | "video" | "audio" | "document" | null = null;
    let attachmentName: string | null = null;
    let attachmentMimeType: string | null = null;
    let attachmentSizeBytes: number | null = null;

    let uploadContentType: string | null = null;
    if (attachment) {
      const resolved = resolveChatAttachment(attachment);
      if (!resolved.ok) {
        setError(resolved.reason);
        setSending(false);
        return;
      }

      mediaType = resolved.mediaType;
      uploadContentType = resolved.contentType;
      mediaPath = `${user.id}/${crypto.randomUUID()}.${resolved.extension}`;
      if (mediaType === "document") {
        attachmentName = safeAttachmentName(attachment.name);
        attachmentMimeType = resolved.contentType;
        attachmentSizeBytes = attachment.size;
      }
    }

    const insertMessage = async () => {
      const { error: sendError } = await (supabase as any)
        .from("direct_messages")
        .insert({
          sender_id: user.id,
          recipient_id: recipient,
          body,
          media_path: mediaPath,
          media_type: mediaType,
          attachment_name: attachmentName,
          attachment_mime_type: attachmentMimeType,
          attachment_size_bytes: attachmentSizeBytes,
          reply_to_message_id: replyTarget?.id ?? null,
        });
      return { error: sendError };
    };

    const result = mediaPath
      ? await uploadThenInsertAttachment(
          async () => {
            const { error } = await supabase.storage.from("chat-media").upload(mediaPath!, attachment!, {
              contentType: uploadContentType ?? attachment!.type || "application/octet-stream",
              upsert: false,
            });
            return { error };
          },
          insertMessage,
          async () => { await supabase.storage.from("chat-media").remove([mediaPath!]); },
        )
      : await insertMessage();

    if (result.error) {
      const detail = result.error && typeof result.error === "object" && "message" in result.error
        ? String((result.error as { message?: unknown }).message ?? "")
        : "";
      setError(mediaPath
        ? detail ? `Attachment could not be sent: ${detail}` : "Attachment could not be sent. Please try again."
        : detail ? `Message could not be sent: ${detail}` : "Message could not be sent. Please try again.");
      setSending(false);
      return;
    }

    setDraft("");
    setSelectedFile(null);
    setReplyTarget(null);
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
if (recipient && chatLock.status !== "unlocked") {
  return <ChatLockPanel lock={chatLock} />;
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
    ...groupInbox.map((item) => ({ kind: "group" as const, ...item, unreadCount: 0, isOnline: false })),
    ...inbox.map((item) => ({
      kind: "direct" as const,
      userId: item.userId,
      displayName: item.displayName,
      handle: item.handle,
      avatarUrl: item.avatarUrl,
      lastMessage: item.lastMessage,
      lastMessageAt: item.lastMessageAt,
      unreadCount: item.unreadCount,
      isOnline: item.isOnline,
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
                  <p className="flex items-center gap-2 font-semibold">{title}{!isGroup && conversation.isOnline && <span className="h-2 w-2 shrink-0 rounded-full bg-green-500" aria-label="Online" />}</p>
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
    <main className="mx-auto flex h-[calc(100dvh-5rem)] min-h-0 max-w-3xl md:h-[94dvh] md:min-h-[560px] flex-col p-3 sm:p-4">
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
            <span>{remoteActivity.some((activity) => activity.activity === "recording")
              ? "Recording audio…"
              : remoteActivity.some((activity) => activity.activity === "typing")
                ? "Typing…"
                : recipientStatus}</span>
          </p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <Button type="button" variant="outline" size="icon" aria-label="Start voice call" disabled={!user?.id || !recipient || startingCall} onClick={() => void startDirectCall("audio")}>
            <Phone className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" aria-label="Start video call" disabled={!user?.id || !recipient || startingCall} onClick={() => void startDirectCall("video")}>
            <Video className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <ChatLockPanel lock={chatLock} />
      <DisappearingSettingsControl chatKind="direct" chatId={recipient} />

      <div
        ref={log}
        className="min-h-[55dvh] min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4"
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
        ) : visibleMessages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Send the first message.
          </p>
        ) : (
          visibleMessages.map((message, index) => {
            const mine = message.sender_id === user.id;
            const showDateDivider = shouldShowDateDivider(message.created_at, visibleMessages[index - 1]?.created_at);

            return (
              <div key={message.id} ref={(node) => { messageRefs.current[message.id] = node; }} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartX.current; touchStartX.current = null; if (start !== null && (event.changedTouches[0]?.clientX ?? start) - start > 60) setReplyTarget(message); }} className="space-y-2">
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
                  {message.deleted_at ? (
                    <p className="py-2 text-sm italic opacity-75">This message was deleted</p>
                  ) : (
                    <>
                  {message.reply_to_message_id && (
                    <button type="button" onClick={() => messageRefs.current[message.reply_to_message_id!]?.scrollIntoView({ behavior: "smooth", block: "center" })} className="mb-2 block w-full rounded-lg border-l-2 border-primary/70 bg-background/20 px-2 py-1 text-left text-xs">
                      <span className="block font-semibold">Replying to</span>
                      <span className="block truncate opacity-80">{messages.find((item) => item.id === message.reply_to_message_id)?.body || "Original message unavailable"}</span>
                    </button>
                  )}
                  {message.media_path && mediaUrls[message.id] && (
                    message.media_type === "document" ? (
                      <MessageAttachment
                        url={mediaUrls[message.id]}
                        fileName={message.attachment_name}
                        mimeType={message.attachment_mime_type}
                        sizeBytes={message.attachment_size_bytes}
                      />
                    ) : message.media_type === "video" ? (
                      <video
                        src={mediaUrls[message.id]}
                        controls
                        playsInline
                        className="mb-2 max-h-[52dvh] w-full max-w-full rounded-lg object-contain"
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
                  {message.location_session_id ? (
                    <LocationShareCard sessionId={message.location_session_id} topic={directActivityTopic} />
                  ) : message.location_latitude !== null && message.location_latitude !== undefined
                    && message.location_longitude !== null && message.location_longitude !== undefined
                    && message.location_captured_at ? (
                    <LocationShareCard oneTime={{
                      latitude: message.location_latitude,
                      longitude: message.location_longitude,
                      accuracyM: message.location_accuracy_m ?? null,
                      capturedAt: message.location_captured_at,
                    }} />
                  ) : null}
                  {message.shared_content_source && message.shared_content_id && message.shared_content_type && (
                    <SharedContentCard
                      source={message.shared_content_source}
                      contentId={message.shared_content_id}
                      contentType={message.shared_content_type}
                    />
                  )}
                  {message.body && (
                    <p className="whitespace-pre-wrap text-sm">
                      {message.body}
                    </p>
                  )}
                  <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-80">
                    <button type="button" onClick={() => setReplyTarget(message)} className="underline-offset-2 hover:underline">Reply</button>
                    {mine && message.body && !message.media_path && message.location_latitude == null && !message.location_session_id && !message.shared_content_id && (
                      <button type="button" onClick={() => void editMessage(message)} className="underline-offset-2 hover:underline" aria-label="Edit message">Edit</button>
                    )}
                    {mine && <button type="button" onClick={() => void deleteMessage(message)} className="underline-offset-2 hover:underline" aria-label="Delete message">Delete</button>}
                    {message.edited_at && <span>Edited</span>}
                    <span className="flex items-center gap-1">
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
                    </span>
                  </div>
                  <MessageReactions messageId={message.id} userId={user.id} reactions={reactions} onToggle={(id, emoji) => void toggleReaction(id, emoji)} />
                    </>
                  )}
                </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {(error || locationSharing.error) && (
        <p role="alert" className="pb-2 text-sm text-destructive">{error || locationSharing.error}</p>
      )}
      {locationSharing.activeSessionId && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <span className="flex items-center gap-2 text-primary"><Radio className="h-3 w-3" /> Live location is sharing</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void locationSharing.stopLiveSharing()}>Stop sharing</Button>
        </div>
      )}

      {replyTarget && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => messageRefs.current[replyTarget.id]?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            <span className="font-semibold">Replying to {replyTarget.sender_id === user.id ? "yourself" : recipientName}</span>
            <span className="ml-2 text-muted-foreground">{replyTarget.body || "Attachment"}</span>
          </button>
          <Button type="button" variant="ghost" size="icon" aria-label="Cancel reply" onClick={() => setReplyTarget(null)}><X className="h-4 w-4" /></Button>
        </div>
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

      {smartReplies.length > 0 && (
        <div className="space-y-2 border-t px-3 py-2">
          <p className="text-[11px] text-muted-foreground">AI suggestions · choose one to edit as a draft</p>
          <div className="flex flex-wrap gap-2">
            {smartReplies.map((suggestion) => (
              <Button key={suggestion} type="button" size="sm" variant="outline" onClick={() => { setDraft(suggestion); setSmartReplies([]); }}>
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
      <form onSubmit={sendMessage} className="shrink-0 space-y-2 border-t pt-3 pb-[env(safe-area-inset-bottom)]">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          aria-label="Choose a photo, video, audio, or document"
          onChange={(event) => {
            const file = event.target.files?.[0] || null;
            if (file) setSelectedFile(file);
          }}
        />
        <div className="flex min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 [scrollbar-width:thin]">
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Attach file" disabled={sending} onClick={() => fileInput.current?.click()}>
            <ImagePlus className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Share current location" disabled={sending || locationSharing.busy} onClick={() => { locationSharing.clearError(); void locationSharing.shareOnce(); }}>
            <MapPin className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Start live location for 15 minutes" disabled={sending || locationSharing.busy || Boolean(locationSharing.activeSessionId)} onClick={() => { locationSharing.clearError(); void locationSharing.startLiveSharing(15); }}>
            <Radio className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Start live location for 1 hour" disabled={sending || locationSharing.busy || Boolean(locationSharing.activeSessionId)} onClick={() => { locationSharing.clearError(); void locationSharing.startLiveSharing(60); }}>
            <span className="text-[10px] font-bold">1h</span>
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Share Nexora content" disabled={sending} onClick={() => setShareContentOpen(true)}>
            <Share2 className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label="Suggest AI replies" disabled={sending || smartRepliesLoading} onClick={() => void suggestSmartReplies()}>
            <Sparkles className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-10 w-10 shrink-0" aria-label={recording ? "Stop voice recording" : "Record voice message"} disabled={sending} onClick={recording ? stopVoiceRecording : startVoiceRecording}>
            {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
        </div>
        <div className="flex min-w-0 items-end gap-2">
          {draftExpanded ? (
            <textarea
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              maxLength={2000}
              rows={3}
              aria-label="Write a message"
              className="min-h-20 max-h-40 min-w-0 flex-1 resize-y rounded-xl border bg-background px-4 py-3 text-base outline-none focus:ring-2 focus:ring-primary"
            />
          ) : (
            <input
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              maxLength={2000}
              aria-label="Write a message"
              className="h-12 min-w-0 flex-1 rounded-xl border bg-background px-4 text-base outline-none focus:ring-2 focus:ring-primary"
            />
          )}
          <Button type="button" variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label={draftExpanded ? "Collapse message draft" : "Expand message draft"} onClick={() => setDraftExpanded((value) => !value)}>
            <span className="text-xs font-semibold">{draftExpanded ? "Less" : "Expand"}</span>
          </Button>
          <Button type="submit" size="icon" className="h-12 w-12 shrink-0" aria-label="Send message" disabled={(!draft.trim() && !selectedFile) || sending || recording}>
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
      <p className="px-3 pb-2 text-[10px] text-muted-foreground">When requested, only the latest six text messages are sent to AI for draft suggestions. Nothing is sent automatically.</p>
      <ShareContentDialog
        open={shareContentOpen}
        onOpenChange={setShareContentOpen}
        onShare={async (reference: SharedContentReference) => {
          if (!user?.id || !recipient) return false;
          const { error: insertError } = await (supabase as any).from("direct_messages").insert({
            sender_id: user.id,
            recipient_id: recipient,
            body: `Shared a ${sharedContentLabel(reference.contentType)}`,
            shared_content_source: reference.source,
            shared_content_id: reference.contentId,
            shared_content_type: reference.contentType,
          });
          if (!insertError) setRefresh((value) => value + 1);
          return !insertError;
        }}
      />
    </main>
  );
          }

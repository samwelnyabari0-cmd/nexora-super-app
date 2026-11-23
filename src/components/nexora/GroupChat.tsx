import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, X, Mic, Square, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GroupMembersDialog } from "@/components/nexora/GroupMembersDialog";
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
import { ConversationDetailsSheet } from "@/components/nexora/ConversationDetailsSheet";
import { ChatAttachmentTray } from "@/components/nexora/ChatAttachmentTray";
import { ChatComposer } from "@/components/nexora/NexoraChatComposer";
import { isMessageExpired, messageExpiryDelay } from "@/components/nexora/message-expiry";
import { buildSmartReplyPrompt, parseSmartReplySuggestions } from "@/components/nexora/smart-replies";
import { aiChat } from "@/lib/ai.functions";
import { ChatLockPanel } from "@/components/nexora/ChatLockPanel";
import { useChatLock } from "@/hooks/useChatLock";
import { flushOfflineMessages, isLikelyNetworkFailure, queueTextMessage } from "@/lib/offline-messages";
import { toast } from "sonner";

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  media_path: string | null;
  media_type: "image" | "video" | "audio" | "document" | null;
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
  created_at: string;
  reply_to_message_id?: string | null;
  edited_at?: string | null;
  deleted_at?: string | null;
};

type SenderProfile = {
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

type GroupInfo = {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
};

type GroupChatProps = {
  groupId: string;
  userId: string;
  onBack: () => void;
};

export function GroupChat({ groupId, userId, onBack }: GroupChatProps) {
  const chatLock = useChatLock(userId, "group", groupId);
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [replyTarget, setReplyTarget] = useState<GroupMessage | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const touchStartX = useRef<number | null>(null);
  const [profiles, setProfiles] = useState<Record<string, SenderProfile>>({});
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false;
    const refreshMediaUrls = async () => {
      const mediaMessages = messages.filter((message) => message.media_path && !isMessageExpired(message.expires_at));
      const entries = await Promise.all(mediaMessages.map(async (message) => {
        const { data } = await supabase.storage.from("chat-media").createSignedUrl(message.media_path!, 60);
        return [message.id, data?.signedUrl ?? ""] as const;
      }));
      if (!cancelled) {
        setMediaUrls((current) => ({
          ...current,
          ...Object.fromEntries(entries.filter(([, url]) => Boolean(url))),
        }));
      }
    };
    void refreshMediaUrls();
    const refreshTimer = window.setInterval(() => void refreshMediaUrls(), 45_000);
    return () => {
      cancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [messages]);

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
    setProfiles({});
    setGroup(null);
    setAvatarUrl("");
  }, [chatLock.status]);
  useEffect(() => {
    if (replyTarget && isMessageExpired(replyTarget.expires_at)) setReplyTarget(null);
  }, [replyTarget]);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [shareContentOpen, setShareContentOpen] = useState(false);
  const [smartReplies, setSmartReplies] = useState<string[]>([]);
  const [smartRepliesLoading, setSmartRepliesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const groupActivityTopic = `group:${groupId}`;
  const { remoteActivity, publishActivity } = useChatActivity({
    topic: groupActivityTopic,
    userId,
    enabled: Boolean(groupId && userId && chatLock.status === "unlocked"),
  });
  const locationSharing = useChatLocationSharing({
    chatKind: "group",
    chatId: groupId,
    userId,
    enabled: Boolean(groupId && userId && chatLock.status === "unlocked"),
    onShareOnce: async (payload: ChatLocationPayload) => {
      const { error: insertError } = await (supabase as any).from("chat_group_messages").insert({
        group_id: groupId,
        sender_id: userId,
        body: "Shared a location",
        location_latitude: payload.latitude,
        location_longitude: payload.longitude,
        location_accuracy_m: payload.accuracyM,
        location_captured_at: payload.capturedAt,
      });
      return !insertError;
    },
    onLiveSession: async (sessionId: string) => {
      const { error: insertError } = await (supabase as any).from("chat_group_messages").insert({
        group_id: groupId,
        sender_id: userId,
        body: "Started live location sharing",
        location_session_id: sessionId,
      });
      return !insertError;
    },
  });

  useEffect(() => {
    publishActivity(recording ? "recording" : draft.trim() ? "typing" : null);
  }, [draft, recording, publishActivity]);

  useEffect(() => {
    if (chatLock.status !== "unlocked") return;
    let active = true;
    const syncQueuedMessages = async () => {
      try {
        const result = await flushOfflineMessages(supabase as any, userId, "group", groupId);
        if (active && result.sent > 0) {
          setRefresh((value) => value + 1);
          window.dispatchEvent(new Event("nexora:outbox-updated"));
        }
      } catch (reason) {
        if (active) console.warn("Could not sync queued group messages:", reason);
      }
    };
    void syncQueuedMessages();
    window.addEventListener("online", syncQueuedMessages);
    window.addEventListener("nexora:outbox-sync", syncQueuedMessages);
    return () => {
      active = false;
      window.removeEventListener("online", syncQueuedMessages);
      window.removeEventListener("nexora:outbox-sync", syncQueuedMessages);
    };
  }, [groupId, userId, chatLock.status]);

  useEffect(() => {
    let cancelled = false;

    async function loadGroup() {
      if (chatLock.status !== "unlocked") {
        setLoading(chatLock.status === "checking");
        return;
      }
      setLoading(true);
      setError("");

      const [{ data: groupData, error: groupError }, { data: messageData, error: messageError }] =
        await Promise.all([
          (supabase as any)
            .from("chat_groups")
            .select("id, name, description, avatar_url")
            .eq("id", groupId)
            .maybeSingle(),
          (supabase as any)
            .from("chat_group_messages")
            .select("id, group_id, sender_id, body, media_path, media_type, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type, expires_at, edited_at, deleted_at")
            .eq("group_id", groupId)
            .order("created_at", { ascending: true }),
        ]);

      if (cancelled) return;
      if (groupError || messageError || !groupData) {
        setGroup(null);
        setMessages([]);
        setError("This group is unavailable or you no longer have access.");
        setLoading(false);
        return;
      }

      const rows = (messageData ?? []) as GroupMessage[];
      setGroup(groupData as GroupInfo);
      setMessages(rows);

      const senderIds = [...new Set(rows.map((message) => message.sender_id))];
      const profileEntries = await Promise.all(
        senderIds.map(async (senderId) => {
          const { data } = await (supabase as any).rpc(
            "get_group_message_sender_profile",
            { p_group_id: groupId, p_user_id: senderId },
          );
          const profile = Array.isArray(data) ? data[0] : data;
          return [senderId, {
            display_name: profile?.display_name ?? null,
            handle: profile?.handle ?? null,
            avatar_url: profile?.avatar_url ?? null,
          }] as const;
        }),
      );

      const mediaEntries = await Promise.all(
        rows.filter((message) => message.media_path).map(async (message) => {
          const { data } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(message.media_path!, 60);
          return [message.id, data?.signedUrl ?? ""] as const;
        }),
      );

      let signedAvatar = "";
      if (groupData.avatar_url) {
        const { data } = await supabase.storage
          .from("chat-media")
          .createSignedUrl(groupData.avatar_url, 3600);
        signedAvatar = data?.signedUrl ?? "";
      }

      if (!cancelled) {
        setProfiles(Object.fromEntries(profileEntries));
        setMediaUrls(Object.fromEntries(mediaEntries.filter(([, url]) => Boolean(url))));
        setAvatarUrl(signedAvatar);
        setLoading(false);
      }
    }

    void loadGroup().catch((reason: unknown) => {
      if (cancelled) return;
      console.error("Group conversation loading failed:", reason);
      setGroup(null);
      setMessages([]);
      setError(reason instanceof Error ? reason.message : "This group could not be loaded. Please try again.");
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [groupId, userId, chatLock.status, refresh]);

  useEffect(() => {
    if (chatLock.status !== "unlocked") return;
    const channel = supabase
      .channel(`group-chat-${groupId}-${userId}`, { config: { private: true } })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          void refreshMessages();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_group_members",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          void verifyMembership();
        },
      )
      .subscribe();

    async function refreshMessages() {
      const { data, error: loadError } = await (supabase as any)
        .from("chat_group_messages")
        .select("id, group_id, sender_id, body, media_path, media_type, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type, expires_at, edited_at, deleted_at")
        .eq("group_id", groupId)
        .order("created_at", { ascending: true });

      if (loadError) {
        setError("You no longer have access to this group.");
        setMessages([]);
        setGroup(null);
        return;
      }
      const rows = (data ?? []) as GroupMessage[];
      setMessages(rows);

      const missingSenders = [...new Set(rows.map((message) => message.sender_id))]
        .filter((senderId) => !profiles[senderId]);
      if (missingSenders.length > 0) {
        const entries = await Promise.all(missingSenders.map(async (senderId) => {
          const { data: profileData } = await (supabase as any).rpc(
            "get_group_message_sender_profile",
            { p_group_id: groupId, p_user_id: senderId },
          );
          const profile = Array.isArray(profileData) ? profileData[0] : profileData;
          return [senderId, {
            display_name: profile?.display_name ?? null,
            handle: profile?.handle ?? null,
            avatar_url: profile?.avatar_url ?? null,
          }] as const;
        }));
        setProfiles((current) => ({ ...current, ...Object.fromEntries(entries) }));
      }

      const newMedia = rows.filter((message) => message.media_path && !mediaUrls[message.id]);
      if (newMedia.length > 0) {
        const entries = await Promise.all(newMedia.map(async (message) => {
          const { data: signed } = await supabase.storage
            .from("chat-media")
            .createSignedUrl(message.media_path!, 60);
          return [message.id, signed?.signedUrl ?? ""] as const;
        }));
        setMediaUrls((current) => ({
          ...current,
          ...Object.fromEntries(entries.filter(([, url]) => Boolean(url))),
        }));
      }
    }

    async function verifyMembership() {
      const { data, error: membershipError } = await (supabase as any)
        .from("chat_group_members")
        .select("id")
        .eq("group_id", groupId)
        .eq("user_id", userId)
        .maybeSingle();
      if (membershipError || !data) {
        setGroup(null);
        setMessages([]);
        setMediaUrls({});
        setError("You are no longer a member of this group.");
      }
    }

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [groupId, userId, profiles, mediaUrls, chatLock.status]);

  useEffect(() => {
    if (messages.length === 0) { setReactions([]); return; }
    let cancelled = false;
    const ids = messages.map((message) => message.id);
    void (supabase as any).from("chat_group_message_reactions")
      .select("message_id, user_id, emoji").in("message_id", ids)
      .then(({ data, error }: { data: MessageReaction[] | null; error: unknown }) => {
        if (!cancelled && !error) setReactions(data ?? []);
      });
    return () => { cancelled = true; };
  }, [messages]);

  useEffect(() => {
    if (!groupId || messages.length === 0) return;
    const channel = supabase.channel(`group-reactions-${groupId}`, { config: { private: true } })
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_message_reactions" }, async () => {
        const ids = messages.map((message) => message.id);
        const { data } = await (supabase as any).from("chat_group_message_reactions")
          .select("message_id, user_id, emoji").in("message_id", ids);
        setReactions(data ?? []);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [groupId, messages]);

  async function editMessage(message: GroupMessage) {
    const nextBody = window.prompt("Edit your message", message.body);
    if (nextBody === null || !nextBody.trim() || nextBody.trim() === message.body) return;
    const { data, error: editError } = await (supabase as any).rpc("edit_group_message", {
      p_message_id: message.id,
      p_body: nextBody.trim(),
    });
    if (editError) { setError(editError.message || "Your message could not be edited."); return; }
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, body: nextBody.trim(), edited_at: data } : item));
  }

  async function deleteMessage(message: GroupMessage) {
    if (!window.confirm("Delete this message for everyone in the group?")) return;
    const { data, error: deleteError } = await (supabase as any).rpc("delete_group_message", { p_message_id: message.id });
    if (deleteError) { setError(deleteError.message || "Your message could not be deleted."); return; }
    setMessages((current) => current.map((item) => item.id === message.id ? { ...item, body: "", media_path: null, media_type: null, attachment_name: null, attachment_mime_type: null, attachment_size_bytes: null, location_latitude: null, location_longitude: null, location_accuracy_m: null, location_captured_at: null, location_session_id: null, shared_content_source: null, shared_content_id: null, shared_content_type: null, deleted_at: data } : item));
    setMediaUrls((current) => { const next = { ...current }; delete next[message.id]; return next; });
  }

  async function toggleReaction(messageId: string, emoji: MessageReactionEmoji) {
    const existing = reactions.find((item) => item.message_id === messageId && item.user_id === userId);
    let result;
    if (existing?.emoji === emoji) {
      result = await (supabase as any).from("chat_group_message_reactions").delete().eq("message_id", messageId).eq("user_id", userId);
    } else if (existing) {
      result = await (supabase as any).from("chat_group_message_reactions").update({ emoji }).eq("message_id", messageId).eq("user_id", userId);
    } else {
      result = await (supabase as any).from("chat_group_message_reactions").insert({ message_id: messageId, user_id: userId, emoji });
    }
    if (result.error) { setError("Your reaction could not be saved."); return; }
    setReactions((current) => [
      ...current.filter((item) => !(item.message_id === messageId && item.user_id === userId)),
      ...(existing?.emoji === emoji ? [] : [{ message_id: messageId, user_id: userId, emoji }]),
    ]);
  }

  useEffect(() => {
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
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
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4") ? "audio/mp4" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
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
        if (blob.size > 0) setAttachment(new File([blob], `voice-message.${extension}`, { type }));
        else setError("No audio was recorded. Please try again.");
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
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function suggestSmartReplies() {
    if (!userId || smartRepliesLoading) return;
    const prompt = buildSmartReplyPrompt(
      messages
        .filter((message) => !isMessageExpired(message.expires_at))
        .map((message) => ({
          sender: message.sender_id === userId ? "You" as const : "Member" as const,
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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || sending || !group) return;

    setSending(true);
    setError("");
    const clientRequestId = attachment ? null : crypto.randomUUID();

    if (!attachment && !navigator.onLine) {
      if (replyTarget) {
        setError("Reconnect to send a reply. Your reply remains in the composer.");
        setSending(false);
        return;
      }
      try {
        await queueTextMessage({ id: clientRequestId!, ownerId: userId, kind: "group", conversationId: groupId, body });
        setDraft("");
        toast.info("Message saved on this device. It will send when you reconnect.");
        window.dispatchEvent(new Event("nexora:outbox-updated"));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Could not save this message offline.");
      } finally {
        setSending(false);
      }
      return;
    }

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
      mediaPath = `groups/${groupId}/${userId}/${crypto.randomUUID()}.${resolved.extension}`;
      if (mediaType === "document") {
        attachmentName = safeAttachmentName(attachment.name);
        attachmentMimeType = resolved.contentType;
        attachmentSizeBytes = attachment.size;
      }
    }

    const insertMessage = async () => {
      const { error: insertError } = await (supabase as any)
        .from("chat_group_messages")
        .insert({
          group_id: groupId,
          sender_id: userId,
          body,
          media_path: mediaPath,
          media_type: mediaType,
          attachment_name: attachmentName,
          attachment_mime_type: attachmentMimeType,
          attachment_size_bytes: attachmentSizeBytes,
          reply_to_message_id: replyTarget?.id ?? null,
          ...(clientRequestId ? { client_request_id: clientRequestId } : {}),
        });
      return { error: insertError };
    };

    const result = mediaPath
      ? await uploadThenInsertAttachment(
          async () => {
            const { error } = await supabase.storage.from("chat-media").upload(mediaPath!, attachment!, {
              contentType: uploadContentType ?? (attachment!.type || "application/octet-stream"),
              upsert: false,
            });
            return { error };
          },
          insertMessage,
          async () => { await supabase.storage.from("chat-media").remove([mediaPath!]); },
        )
      : await insertMessage();

    if (result.error && !mediaPath && clientRequestId && !replyTarget && isLikelyNetworkFailure(result.error)) {
      try {
        await queueTextMessage({ id: clientRequestId, ownerId: userId, kind: "group", conversationId: groupId, body });
        setDraft("");
        toast.info("Connection dropped. Your message is saved and will send when you reconnect.");
        window.dispatchEvent(new Event("nexora:outbox-updated"));
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "The connection dropped and this message could not be saved.");
      } finally {
        setSending(false);
      }
      return;
    }

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
    setAttachment(null);
    setReplyTarget(null);
    if (fileInput.current) fileInput.current.value = "";
    setSending(false);
  }

  if (chatLock.status !== "unlocked") return <ChatLockPanel lock={chatLock} />;

  if (loading) {
    return <p className="py-10 text-center text-sm text-muted-foreground">Loading group...</p>;
  }

  if (!group) {
    return (
      <div className="space-y-4 p-6 text-center">
        <p className="text-sm text-destructive">{error || "This group is unavailable."}</p>
        <Button variant="outline" onClick={onBack}>Back to messages</Button>
      </div>
    );
  }

  return (
    <main className="mx-auto flex h-[100dvh] min-h-0 min-w-0 max-w-3xl flex-col gap-2 overflow-hidden px-3 pb-0 pt-2 sm:px-4">
      <header className="sticky top-0 z-20 flex items-center gap-2 border-b bg-background/95 py-2 backdrop-blur">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <ConversationDetailsSheet
          title={group.name}
          subtitle={remoteActivity.length > 0
            ? `${profiles[remoteActivity[0].user_id]?.display_name || "A member"} ${remoteActivity[0].activity === "recording" ? "is recording audio…" : "is typing…"}`
            : group.description || "Group conversation"}
          avatarUrl={avatarUrl}
          initials={group.name.charAt(0).toUpperCase()}
          chatKind="group"
          chatId={groupId}
          lock={chatLock}
          trailing={<Button type="button" variant="outline" size="sm" onClick={() => setShareContentOpen(true)}>Share Nexora content</Button>}
        />
        <GroupMembersDialog
          groupId={groupId}
          userId={userId}
          onLeave={onBack}
        />
      </header>

      <div ref={log} className="min-h-0 min-w-0 flex-1 space-y-3 overflow-y-auto overscroll-contain py-4" role="log" aria-live="polite">
        {visibleMessages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello to the group.
          </p>
        ) : visibleMessages.map((message, index) => {
          const mine = message.sender_id === userId;
          const showDateDivider = shouldShowDateDivider(message.created_at, visibleMessages[index - 1]?.created_at);
          const sender = profiles[message.sender_id];
          return (
            <div key={message.id} ref={(node) => { messageRefs.current[message.id] = node; }} onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }} onTouchEnd={(event) => { const start = touchStartX.current; touchStartX.current = null; if (start !== null && (event.changedTouches[0]?.clientX ?? start) - start > 60) setReplyTarget(message); }} className="space-y-2">
              {showDateDivider && (
                <div className="sticky top-1 z-10 flex justify-center py-1">
                  <span className="rounded-full border bg-background/90 px-3 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur">{getMessageDateLabel(message.created_at)}</span>
                </div>
              )}
              <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`mx-3 flex max-w-[82%] min-w-0 gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (
                  sender?.handle ? (
                    <Link to="/profile/$handle" params={{ handle: sender.handle.replace(/^@+/, "") }} aria-label={`Open @${sender.handle}'s profile`} className="mt-5 shrink-0">
                      {sender.avatar_url ? (
                        <img src={sender.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                          {(sender.display_name || sender.handle || "N").charAt(0).toUpperCase()}
                        </span>
                      )}
                    </Link>
                  ) : sender?.avatar_url ? (
                    <img src={sender.avatar_url} alt="" className="mt-5 h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {(sender?.display_name || sender?.handle || "N").charAt(0).toUpperCase()}
                    </span>
                  )
                )}
                <div className={`min-w-0 max-w-full break-words [overflow-wrap:anywhere] rounded-2xl px-3 py-2.5 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {message.deleted_at ? (
                    <p className="py-2 text-sm italic opacity-75">This message was deleted</p>
                  ) : (
                    <>
                  {!mine && (
                    <p className="mb-1 text-xs font-semibold">
                      {sender?.handle ? (
                        <Link to="/profile/$handle" params={{ handle: sender.handle.replace(/^@+/, "") }} className="hover:underline">
                          {sender?.display_name || "NEXORA User"}
                          <span className="ml-1 font-normal opacity-70">@{sender.handle}</span>
                        </Link>
                      ) : (sender?.display_name || "NEXORA User")}
                    </p>
                  )}
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
                      <video src={mediaUrls[message.id]} controls playsInline className="mb-2 block aspect-video w-full max-w-[240px] rounded-lg bg-black object-contain" />
                    ) : message.media_type === "audio" ? (
                      <VoiceNotePlayer src={mediaUrls[message.id]} mine={mine} />
                    ) : (
                      <img src={mediaUrls[message.id]} alt="Shared group attachment" className="mb-2 max-h-44 max-w-[240px] rounded-lg object-contain" />
                    )
                  )}
                  {message.location_session_id ? (
                    <LocationShareCard sessionId={message.location_session_id} topic={groupActivityTopic} />
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
                  {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
                  <div className="mt-1 flex items-center justify-end gap-2 text-[10px] opacity-80">
                    <button type="button" onClick={() => setReplyTarget(message)} className="underline-offset-2 hover:underline">Reply</button>
                    {mine && message.body && !message.media_path && message.location_latitude == null && !message.location_session_id && !message.shared_content_id && (
                      <button type="button" onClick={() => void editMessage(message)} className="underline-offset-2 hover:underline" aria-label="Edit message">Edit</button>
                    )}
                    {mine && <button type="button" onClick={() => void deleteMessage(message)} className="underline-offset-2 hover:underline" aria-label="Delete message">Delete</button>}
                    {message.edited_at && <span>Edited</span>}
                    <span>
                    {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                  <MessageReactions messageId={message.id} userId={userId} reactions={reactions} onToggle={(id, emoji) => void toggleReaction(id, emoji)} />
                    </>
                  )}
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {(error || locationSharing.error) && <p role="alert" className="pb-2 text-sm text-destructive">{error || locationSharing.error}</p>}
      {locationSharing.activeSessionId && (
        <div className="flex items-center justify-between border-t px-3 py-2 text-xs">
          <span className="flex items-center gap-2 text-primary"><Radio className="h-3 w-3" /> Live location is sharing</span>
          <Button type="button" size="sm" variant="outline" onClick={() => void locationSharing.stopLiveSharing()}>Stop sharing</Button>
        </div>
      )}
      {replyTarget && (
        <div className="flex items-center justify-between gap-2 border-t px-3 py-2 text-xs">
          <button type="button" className="min-w-0 flex-1 truncate text-left" onClick={() => messageRefs.current[replyTarget.id]?.scrollIntoView({ behavior: "smooth", block: "center" })}>
            <span className="font-semibold">Replying to {replyTarget.sender_id === userId ? "yourself" : profiles[replyTarget.sender_id]?.display_name || "member"}</span>
            <span className="ml-2 text-muted-foreground">{replyTarget.body || "Attachment"}</span>
          </button>
          <Button type="button" variant="ghost" size="icon" aria-label="Cancel reply" onClick={() => setReplyTarget(null)}><X className="h-4 w-4" /></Button>
        </div>
      )}
      {attachment && (
        <div className="flex items-center justify-between border-t px-2 py-2 text-sm">
          <span className="min-w-0 truncate">📎 {attachment.name}</span>
          <Button type="button" variant="ghost" size="icon" aria-label="Remove attachment" onClick={() => {
            setAttachment(null);
            if (fileInput.current) fileInput.current.value = "";
          }}>
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
      <form onSubmit={sendMessage} className="shrink-0 space-y-3 border-t pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
        <input
          ref={fileInput}
          type="file"
          accept="image/*,video/*,audio/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          aria-label="Choose a group photo, video, audio, or document"
          onChange={(event) => {
            chatLock.endAttachmentPicker();
            setAttachment(event.target.files?.[0] ?? null);
          }}
        />
        <NexoraChatComposer
          value={draft}
          onValueChange={setDraft}
          placeholder="Message the group..."
          disabled={sending || recording}
          canSend={Boolean(draft.trim() || attachment)}
          sendLabel="Send group message"
          leadingAction={
            <ChatAttachmentTray
              disabled={sending || recording}
              actions={{
                gallery: () => { chatLock.beginAttachmentPicker(); fileInput.current?.click(); },
                document: () => { chatLock.beginAttachmentPicker(); fileInput.current?.click(); },
                location: () => { locationSharing.clearError(); void locationSharing.shareOnce(); },
                goLive: () => { locationSharing.clearError(); void locationSharing.startLiveSharing(15); },
                ephemeral: () => { locationSharing.clearError(); void locationSharing.startLiveSharing(60); },
                aiAssist: () => void suggestSmartReplies(),
              }}
            />
          }
          trailingAction={
            <Button type="button" variant="ghost" size="icon" className="h-10 w-10 shrink-0" aria-label={recording ? "Stop voice recording" : "Record voice message"} disabled={sending} onClick={recording ? stopVoiceRecording : startVoiceRecording}>
              {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          }
        />
      </form>
      <ShareContentDialog
        open={shareContentOpen}
        onOpenChange={setShareContentOpen}
        onShare={async (reference: SharedContentReference) => {
          const { error: insertError } = await (supabase as any).from("chat_group_messages").insert({
            group_id: groupId,
            sender_id: userId,
            body: `Shared a ${sharedContentLabel(reference.contentType)}`,
            shared_content_source: reference.source,
            shared_content_id: reference.contentId,
            shared_content_type: reference.contentType,
          });
          return !insertError;
        }}
      />
    </main>
  );
}

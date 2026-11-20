import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ImagePlus, Loader2, Send, X, Mic, Square, MapPin, Radio, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GroupMembersDialog } from "@/components/nexora/GroupMembersDialog";
import { formatMessageTime, getMessageDateLabel, shouldShowDateDivider } from "@/components/nexora/message-format";
import { VoiceNotePlayer } from "@/components/nexora/VoiceNotePlayer";
import { useChatActivity } from "@/hooks/useChatActivity";
import { MessageReactions, type MessageReaction, type MessageReactionEmoji } from "@/components/nexora/MessageReactions";
import { MessageAttachment } from "@/components/nexora/MessageAttachment";
import { safeAttachmentName, uploadThenInsertAttachment, validateDocumentFile } from "@/components/nexora/message-attachments";
import { LocationShareCard } from "@/components/nexora/LocationShareCard";
import { useChatLocationSharing } from "@/hooks/useChatLocationSharing";
import type { ChatLocationPayload } from "@/components/nexora/location-sharing";
import { ShareContentDialog } from "@/components/nexora/ShareContentDialog";
import { SharedContentCard } from "@/components/nexora/SharedContentCard";
import { sharedContentLabel, type SharedContentReference } from "@/components/nexora/shared-content";
import { DisappearingSettingsControl } from "@/components/nexora/DisappearingSettingsControl";
import { isMessageExpired, messageExpiryDelay } from "@/components/nexora/message-expiry";

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
  const [group, setGroup] = useState<GroupInfo | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [reactions, setReactions] = useState<MessageReaction[]>([]);
  const [replyTarget, setReplyTarget] = useState<GroupMessage | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const touchStartX = useRef<number | null>(null);
  const [profiles, setProfiles] = useState<Record<string, SenderProfile>>({});
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
  const [avatarUrl, setAvatarUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [shareContentOpen, setShareContentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);
  const groupActivityTopic = `group:${groupId}`;
  const { remoteActivity, publishActivity } = useChatActivity({
    topic: groupActivityTopic,
    userId,
    enabled: Boolean(groupId && userId),
  });
  const locationSharing = useChatLocationSharing({
    chatKind: "group",
    chatId: groupId,
    userId,
    enabled: Boolean(groupId && userId),
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
    let cancelled = false;

    async function loadGroup() {
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
            .select("id, group_id, sender_id, body, media_path, media_type, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type, expires_at")
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
            .createSignedUrl(message.media_path!, 3600);
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

    void loadGroup();
    return () => {
      cancelled = true;
    };
  }, [groupId, userId]);

  useEffect(() => {
    const channel = supabase
      .channel(`group-chat-${groupId}-${userId}`)
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
        .select("id, group_id, sender_id, body, media_path, media_type, created_at, reply_to_message_id, attachment_name, attachment_mime_type, attachment_size_bytes, location_latitude, location_longitude, location_accuracy_m, location_captured_at, location_session_id, shared_content_source, shared_content_id, shared_content_type")
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
            .createSignedUrl(message.media_path!, 3600);
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
  }, [groupId, userId, profiles, mediaUrls]);

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
    const channel = supabase.channel(`group-reactions-${groupId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_group_message_reactions" }, async () => {
        const ids = messages.map((message) => message.id);
        const { data } = await (supabase as any).from("chat_group_message_reactions")
          .select("message_id, user_id, emoji").in("message_id", ids);
        setReactions(data ?? []);
      }).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [groupId, messages]);

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

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || sending || !group) return;

    setSending(true);
    setError("");
    let mediaPath: string | null = null;
    let mediaType: "image" | "video" | "audio" | "document" | null = null;
    let attachmentName: string | null = null;
    let attachmentMimeType: string | null = null;
    let attachmentSizeBytes: number | null = null;

    if (attachment) {
      const isImage = attachment.type.startsWith("image/");
      const isVideo = attachment.type.startsWith("video/");
      const isAudio = attachment.type.startsWith("audio/");
      const document = validateDocumentFile(attachment);
      if (!isImage && !isVideo && !isAudio && !document.ok) {
        setError(document.reason);
        setSending(false);
        return;
      }
      if (attachment.size > 50 * 1024 * 1024) {
        setError("The file must be 50 MB or smaller.");
        setSending(false);
        return;
      }

      mediaType = document.ok && !isImage && !isVideo && !isAudio
        ? "document"
        : isImage ? "image" : isVideo ? "video" : "audio";
      const extension = document.ok && mediaType === "document"
        ? document.extension
        : attachment.name.split(".").pop()?.toLowerCase() || (isImage ? "jpg" : isVideo ? "mp4" : "webm");
      mediaPath = `groups/${groupId}/${userId}/${crypto.randomUUID()}.${extension}`;
      if (mediaType === "document") {
        attachmentName = safeAttachmentName(attachment.name);
        attachmentMimeType = attachment.type;
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
        });
      return { error: insertError };
    };

    const result = mediaPath
      ? await uploadThenInsertAttachment(
          async () => {
            const { error } = await supabase.storage.from("chat-media").upload(mediaPath!, attachment!, {
              contentType: attachment!.type,
              upsert: false,
            });
            return { error };
          },
          insertMessage,
          async () => { await supabase.storage.from("chat-media").remove([mediaPath!]); },
        )
      : await insertMessage();

    if (result.error) {
      setError(mediaPath ? "Attachment could not be sent. Please try again." : "Your message could not be sent. Please try again.");
      setSending(false);
      return;
    }

    setDraft("");
    setAttachment(null);
    setReplyTarget(null);
    if (fileInput.current) fileInput.current.value = "";
    setSending(false);
  }

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
    <main className="mx-auto flex h-[85dvh] min-h-[500px] max-w-3xl flex-col p-3 sm:p-4">
      <header className="flex items-center gap-3 border-b pb-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to messages">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-lg font-bold">
            {group.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-semibold">{group.name}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {remoteActivity.length > 0
              ? `${profiles[remoteActivity[0].user_id]?.display_name || "A member"} ${remoteActivity[0].activity === "recording" ? "is recording audio…" : "is typing…"}`
              : group.description || "Group conversation"}
          </p>
        </div>
        <GroupMembersDialog
          groupId={groupId}
          userId={userId}
          onLeave={onBack}
        />
      </header>
      <DisappearingSettingsControl chatKind="group" chatId={groupId} />

      <div ref={log className="flex-1 space-y-3 overflow-y-auto py-4" role="log" aria-live="polite">
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
              <div className={`flex max-w-[88%] gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && (
                  sender?.avatar_url ? (
                    <img src={sender.avatar_url} alt="" className="mt-5 h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <span className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                      {(sender?.display_name || sender?.handle || "N").charAt(0).toUpperCase()}
                    </span>
                  )
                )}
                <div className={`min-w-0 rounded-2xl px-4 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                  {!mine && (
                    <p className="mb-1 text-xs font-semibold">
                      {sender?.display_name || "NEXORA User"}
                      {sender?.handle ? <span className="ml-1 font-normal opacity-70">@{sender.handle}</span> : null}
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
                      <video src={mediaUrls[message.id]} controls playsInline className="mb-2 max-h-72 max-w-full rounded-lg" />
                    ) : message.media_type === "audio" ? (
                      <VoiceNotePlayer src={mediaUrls[message.id]} mine={mine} />
                    ) : (
                      <img src={mediaUrls[message.id]} alt="Shared group attachment" className="mb-2 max-h-72 max-w-full rounded-lg object-contain" />
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
                    <span>
                    {formatMessageTime(message.created_at)}
                    </span>
                  </div>
                  <MessageReactions messageId={message.id} userId={userId} reactions={reactions} onToggle={(id, emoji) => void toggleReaction(id, emoji)} />
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

      <form onSubmit={sendMessage} className="flex items-center gap-2 border-t pt-3">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          className="hidden"
          aria-label="Choose a group photo, video, audio, or document"
          onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" size="icon" aria-label="Attach file" disabled={sending || recording} onClick={() => fileInput.current?.click()}>
          <ImagePlus className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Share current location" disabled={sending || recording || locationSharing.busy} onClick={() => { locationSharing.clearError(); void locationSharing.shareOnce(); }}>
          <MapPin className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Start live location for 15 minutes" disabled={sending || recording || locationSharing.busy || Boolean(locationSharing.activeSessionId)} onClick={() => { locationSharing.clearError(); void locationSharing.startLiveSharing(15); }}>
          <Radio className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Start live location for 1 hour" disabled={sending || recording || locationSharing.busy || Boolean(locationSharing.activeSessionId)} onClick={() => { locationSharing.clearError(); void locationSharing.startLiveSharing(60); }}>
          <span className="text-[10px] font-bold">1h</span>
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label="Share Nexora content" disabled={sending || recording} onClick={() => setShareContentOpen(true)}>
          <Share2 className="h-4 w-4" />
        </Button>
        <Button type="button" variant="outline" size="icon" aria-label={recording ? "Stop voice recording" : "Record voice message"} disabled={sending} onClick={recording ? stopVoiceRecording : startVoiceRecording}>
          {recording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
        </Button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          placeholder="Message the group..."
          aria-label="Message the group"
          className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="icon" aria-label="Send group message" disabled={(!draft.trim() && !attachment) || sending || recording}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
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

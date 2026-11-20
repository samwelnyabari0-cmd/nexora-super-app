import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ImagePlus, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { GroupMembersDialog } from "@/components/nexora/GroupMembersDialog";
import { formatMessageTime, getMessageDateLabel, shouldShowDateDivider } from "@/components/nexora/message-format";
import { VoiceNotePlayer } from "@/components/nexora/VoiceNotePlayer";

type GroupMessage = {
  id: string;
  group_id: string;
  sender_id: string;
  body: string;
  media_path: string | null;
  media_type: "image" | "video" | "audio" | null;
  created_at: string;
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
  const [profiles, setProfiles] = useState<Record<string, SenderProfile>>({});
  const [mediaUrls, setMediaUrls] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState("");
  const [draft, setDraft] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const log = useRef<HTMLDivElement>(null);

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
            .select("id, group_id, sender_id, body, media_path, media_type, created_at")
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
        .select("id, group_id, sender_id, body, media_path, media_type, created_at")
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
    if (log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [messages]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = draft.trim();
    if ((!body && !attachment) || sending || !group) return;

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
      const extension = attachment.name.split(".").pop()?.toLowerCase() ||
        (isImage ? "jpg" : isVideo ? "mp4" : "webm");
      mediaPath = `groups/${groupId}/${userId}/${crypto.randomUUID()}.${extension}`;

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

    const { error: insertError } = await (supabase as any)
      .from("chat_group_messages")
      .insert({
        group_id: groupId,
        sender_id: userId,
        body,
        media_path: mediaPath,
        media_type: mediaType,
      });

    if (insertError) {
      if (mediaPath) {
        await supabase.storage.from("chat-media").remove([mediaPath]);
      }
      setError("Your message could not be sent. Please try again.");
      setSending(false);
      return;
    }

    setDraft("");
    setAttachment(null);
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
            {group.description || "Group conversation"}
          </p>
        </div>
        <GroupMembersDialog
          groupId={groupId}
          userId={userId}
          onLeave={onBack}
        />
      </header>

      <div ref={log} className="flex-1 space-y-3 overflow-y-auto py-4" role="log" aria-live="polite">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">
            No messages yet. Say hello to the group.
          </p>
        ) : messages.map((message, index) => {
          const mine = message.sender_id === userId;
          const showDateDivider = shouldShowDateDivider(message.created_at, messages[index - 1]?.created_at);
          const sender = profiles[message.sender_id];
          return (
            <div key={message.id} className="space-y-2">
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
                  {message.media_path && mediaUrls[message.id] && (
                    message.media_type === "video" ? (
                      <video src={mediaUrls[message.id]} controls playsInline className="mb-2 max-h-72 max-w-full rounded-lg" />
                    ) : message.media_type === "audio" ? (
                      <VoiceNotePlayer src={mediaUrls[message.id]} mine={mine} />
                    ) : (
                      <img src={mediaUrls[message.id]} alt="Shared group attachment" className="mb-2 max-h-72 max-w-full rounded-lg object-contain" />
                    )
                  )}
                  {message.body && <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>}
                  <p className="mt-1 text-right text-[10px] opacity-70">
                    {formatMessageTime(message.created_at)}
                  </p>
                </div>
              </div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <p role="alert" className="pb-2 text-sm text-destructive">{error}</p>}
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
          accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/webm,audio/mp4,audio/ogg,audio/mpeg,audio/wav"
          className="hidden"
          aria-label="Choose a group attachment"
          onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
        />
        <Button type="button" variant="outline" size="icon" aria-label="Attach media" disabled={sending} onClick={() => fileInput.current?.click()}>
          <ImagePlus className="h-4 w-4" />
        </Button>
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          placeholder="Message the group..."
          aria-label="Message the group"
          className="min-w-0 flex-1 rounded-xl border bg-background px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary"
        />
        <Button type="submit" size="icon" aria-label="Send group message" disabled={(!draft.trim() && !attachment) || sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </main>
  );
}

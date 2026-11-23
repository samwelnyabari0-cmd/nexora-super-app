import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { validMessage, type Attachment } from "./tools";
import { useWorkspace } from "./workspace";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { cleanupR2MediaObjects } from "@/lib/r2-media.functions";
import { getFreshR2MediaPlaybackUrl } from "@/lib/r2-media-playback";
import { getR2PostObjectKeys } from "@/lib/r2-post-cleanup";
import { useSession } from "@/lib/session";
import {
  addCommentToPost,
  getMyRepostedPostIds,
  likePost,
  repostPost,
  sharePost,
  unlikePost,
} from "@/lib/social-activity";
import {
  seedTxns,
  type Conversation,
  type Post,
  type Txn,
} from "./data";

// ---------- Shared identity + permissions (Pulse Passport) ----------
export type Passport = {
  name: string;
  handle: string;
  bio: string;
  avatarUrl?: string | null;
  reputation: number;
  interests: string[];
  share: { interests: boolean; location: boolean; reputation: boolean; activity: boolean };
};

// ---------- Event layer ----------
export type AppEvent = { id: string; type: string; detail: string; at: number };

// ---------- Offline relay ----------
export type RelayItem = {
  id: string;
  kind: "message" | "post" | "draft";
  label: string;
  payload: unknown;
};

type State = {
  posts: Post[];
  postsLoading: boolean;
  liked: Set<string>;
  saved: Set<string>;
  reposted: Set<string>;
  conversations: Conversation[];
  balance: number;
  txns: Txn[];
  passport: Passport;
  online: boolean;
  relay: RelayItem[];
  events: AppEvent[];
};

type Ctx = State & {
  toggleLike(id: string): void;
  toggleSave(id: string): void;
  addComment(id: string, text: string): void;
  share(id: string): void;
  repost(id: string): void;
  deletePost(id: string): Promise<boolean>;
    createPost(
    p: Omit<Post, "id" | "likes" | "comments" | "shares" | "createdAt" | "creatorId">,
    draftId?: string,
    persistedId?: string,
  ): void;
  sendMessage(convId: string, text: string, attachments?: Attachment[], replyTo?: string): void;
  startConversation(creatorId: string): string;
  editMessage(convId: string, messageId: string, text: string): void;
  deleteMessage(convId: string, messageId: string): void;
  markConversationRead(convId: string): void;
  sendMoney(to: string, amount: number, note: string): void;
  creditWallet(amount: number, label: string): void;
  updatePassport(p: Partial<Passport>): void;
  setOnline(v: boolean): void;
  syncRelay(): void;
  emit(type: string, detail: string): void;
};

const AppCtx = createContext<Ctx | null>(null);
const uid = () => Math.random().toString(36).slice(2, 9);
const now = () => new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function AppProvider({ children }: { children: ReactNode }) {
  const { notify, preferences, removeDraft } = useWorkspace();
  const { user } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [reposted, setReposted] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [balance, setBalance] = useState(24680.5);
  const [txns, setTxns] = useState(seedTxns);
  const [online, setOnlineState] = useState(true);
  const [relay, setRelay] = useState<RelayItem[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [passport, setPassport] = useState<Passport>({
  name: "NEXORA User",
  handle: "nexorauser",
  bio: "",
  avatarUrl: null,
  reputation: 0,
  interests: [],
  share: { interests: false, location: false, reputation: false, activity: false },
});

  useEffect(() => {
    setConversations([]);
    if (!user) { setPosts([]); setPostsLoading(false); return; }
    setPostsLoading(true);
    void (async () => {
      try {
            const { data: ownProfile, error: ownProfileError } = await (supabase as any)
  .from("profiles")
  .select("display_name, handle, bio, interests, settings, avatar_url")
  .eq("id", user.id)
  .maybeSingle();

if (ownProfileError) {
  console.error("Could not load your profile:", ownProfileError.message);
}

if (ownProfile) {
  const emailName = user.email?.split("@")[0] ?? "";

  setPassport((current) => ({
    ...current,
    name:
      ownProfile.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      emailName ||
      "NEXORA User",
    handle:
      ownProfile.handle ||
      user.user_metadata?.handle ||
      emailName.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() ||
      user.id.slice(0, 8),
    bio: ownProfile.bio || "",
    avatarUrl: ownProfile.avatar_url ?? null,
    interests: ownProfile.interests ?? current.interests,
    share: ownProfile.settings?.share ?? current.share,
  }));
}
      const { data: savedPosts, error: feedError } = await (supabase as any)
        .rpc("get_balanced_nexora_feed", { p_limit: 500, p_offset: 0 });
      if (feedError) throw feedError;

      // Publish lightweight post cards as soon as the feed query returns.
      // Profile, reaction and signed-media hydration must not make a real feed
      // appear empty while secondary requests are still completing.
      const basicPosts = (savedPosts ?? []).map((row: any) => ({
        id: row.id,
        mediaPostId: row.id,
        mediaStorageProvider: row.media_storage_provider ?? "supabase",
        creatorId: row.user_id === user.id ? "me" : (row.user_id ?? "me"),
        creatorName: row.user_id === user.id ? (ownProfile?.display_name ?? passport.name) : "NEXORA member",
        creatorHandle: row.user_id === user.id ? (ownProfile?.handle ?? passport.handle) : "",
        creatorAvatarUrl: row.user_id === user.id ? (ownProfile?.avatar_url ?? null) : null,
        caption: row.caption ?? "",
        image: /^https?:\\/\\//i.test(row.media_url ?? "") ? row.media_url : undefined,
        mediaType: row.media_type ?? undefined,
        kind: row.content_type === "reel" ? "short" : row.content_type === "video" ? "video" : "post",
        duration: row.duration_seconds == null ? undefined : `${Math.floor(row.duration_seconds / 60)}:${String(row.duration_seconds % 60).padStart(2, "0")}`,
        audience: row.audience ?? "public",
        tags: row.tags ?? [],
        filter: "original",
        format: "landscape",
        aspectRatio: row.aspect_ratio ?? null,
        frameRatio: row.framing_aspect_ratio ?? "original",
        focalX: Number(row.focal_x ?? 50),
        focalY: Number(row.focal_y ?? 50),
        zoom: Number(row.zoom ?? 1),
        dominantColor: row.dominant_color ?? null,
        likes: Number(row.like_count ?? 0),
        comments: [],
        shares: Number(row.share_count ?? 0),
        reposts: Number(row.repost_count ?? 0),
        views: Number(row.view_count ?? 0),
        createdAt: row.created_at,
      } as unknown as Post));
      setPosts(basicPosts);

      const [
        { data: savedMessages },
        { data: myLikedPostIds },
        myRepostedPostIds,
        { data: savedComments },
      ] = await Promise.all([
        (supabase as any)
          .from("message_threads")
          .select("id, conversation_key, body, metadata, created_at")
          .eq("sender_id", user.id)
          .order("created_at", { ascending: true }),
        supabase.rpc("get_my_liked_user_media_posts"),
        getMyRepostedPostIds().catch(() => []),
        (supabase as any)
          .from("user_media_post_comments")
          .select("id, post_id, user_id, text, created_at")
          .order("created_at", { ascending: true }),
      ]);

      setLiked(
        new Set(
          (myLikedPostIds ?? []).map((id: string) => id),
        ),
      );
            setReposted(new Set(myRepostedPostIds ?? []));
      const postAuthorIds = [...new Set((savedPosts ?? []).map((post: any) => post.user_id).filter(Boolean))];
      const { data: postAuthorProfiles, error: postAuthorError } = await (supabase as any)
        .rpc("get_post_author_profiles", { target_user_ids: postAuthorIds });
      if (postAuthorError) console.error("Could not load post authors:", postAuthorError.message);
      const postAuthorById = new Map((postAuthorProfiles ?? []).map((profile: any) => [profile.id, profile]));
      const commentUserIds = [
  ...new Set((savedComments ?? []).map((comment: any) => comment.user_id)),
];

const { data: commentProfiles, error: commentProfilesError } = await (supabase as any)
  .rpc("get_public_comment_profiles", {
    target_user_ids: commentUserIds,
  });

if (commentProfilesError) {
  console.error("Could not load comment profiles:", commentProfilesError.message);
}

const commentProfileById = new Map(
  (commentProfiles ?? []).map((profile: any) => [profile.id, profile]),
);
      const { data: myBookmarks, error: bookmarkError } = await (supabase as any)
  .from("user_media_post_bookmarks")
  .select("post_id")
  .eq("user_id", user.id);

if (bookmarkError) {
  console.error("Could not load bookmarks:", bookmarkError.message);
} else {
  setSaved(new Set((myBookmarks ?? []).map((item: any) => item.post_id)));
}
      if (savedPosts?.length) {
        const hydratedPosts = await Promise.all(
          savedPosts.map(async (row: any) => {
            let image: string | undefined;
            let thumbnailUrl: string | undefined;
            const media = row.media_url ?? undefined;
            if (row.media_storage_provider === "r2") {
              image = await getFreshR2MediaPlaybackUrl(row.id, "media");
            } else if (media) {
              if (/^https?:\/\//i.test(media)) {
                image = media;
              } else {
                const { data } = await supabase.storage.from("post-media").createSignedUrl(row.media_storage_key || media, 3600);
                image = data?.signedUrl ?? undefined;
              }
            }
            if (row.thumbnail_storage_provider === "r2") {
              thumbnailUrl = await getFreshR2MediaPlaybackUrl(row.id, "thumbnail");
            } else if (row.thumbnail_url) {
              if (/^https?:\/\//i.test(row.thumbnail_url)) thumbnailUrl = row.thumbnail_url;
              else {
                const { data: thumbData } = await supabase.storage.from("post-media")
                  .createSignedUrl(row.thumbnail_storage_key || row.thumbnail_url, 3600);
                thumbnailUrl = thumbData?.signedUrl ?? undefined;
              }
            }
            return {
              id: row.id,
              mediaPostId: row.id,
              mediaStorageProvider: row.media_storage_provider ?? "supabase",
              creatorId: row.user_id === user.id ? "me" : (row.user_id ?? "me"),
              creatorName: row.user_id === user.id ? (ownProfile?.display_name ?? passport.name) : (postAuthorById.get(row.user_id)?.display_name ?? "NEXORA member"),
              creatorHandle: row.user_id === user.id ? (ownProfile?.handle ?? passport.handle) : (postAuthorById.get(row.user_id)?.handle ?? ""),
              creatorAvatarUrl: row.user_id === user.id ? (ownProfile?.avatar_url ?? null) : (postAuthorById.get(row.user_id)?.avatar_url ?? null),
              caption: row.caption ?? "",
              image,
              thumbnailUrl,
              mediaType: row.media_type ?? undefined,
              kind: row.content_type === "reel" ? "short" : row.content_type === "video" ? "video" : "post",
              duration: row.duration_seconds == null ? undefined : `${Math.floor(row.duration_seconds / 60)}:${String(row.duration_seconds % 60).padStart(2, "0")}`,
              audience: row.audience ?? "public",
              tags: row.tags ?? [],
              filter: "original",
              format: "landscape",
              aspectRatio: row.aspect_ratio ?? null,
              frameRatio: row.framing_aspect_ratio ?? "original",
              focalX: Number(row.focal_x ?? 50),
              focalY: Number(row.focal_y ?? 50),
              zoom: Number(row.zoom ?? 1),
              dominantColor: row.dominant_color ?? null,
              likes: Number(row.like_count ?? 0),
                            comments: (savedComments ?? [])
                .filter((comment: any) => comment.post_id === row.id)
                .map((comment: any) => ({
  id: comment.id,
  author:
  comment.user_id === user.id
    ? passport.handle
    : commentProfileById.get(comment.user_id)?.handle ??
      commentProfileById.get(comment.user_id)?.display_name ??
      "member",
  text: comment.text,
  createdAt: comment.created_at,
})),
                  shares: Number(row.share_count ?? 0),
              reposts: Number(row.repost_count ?? 0),
              views: Number(row.view_count ?? 0),
              createdAt: row.created_at,
            } as unknown as Post;
          }),
        );
        setPosts(hydratedPosts);
      } else {
        setPosts([]);
      }
      if (savedMessages?.length) {
        const grouped = savedMessages.reduce((groups: Record<string, any[]>, row: any) => {
          (groups[row.conversation_key] ??= []).push(row);
          return groups;
        }, {});
        setConversations(Object.entries(grouped).map(([id, rows]) => ({
          id,
          creatorId: id,
          ownerId: user.id,
          unread: 0,
          messages: rows.map((row: any) => ({
            id: row.id,
            from: "me" as const,
            text: row.body,
            attachments: row.metadata?.attachments ?? [],
            replyTo: row.metadata?.replyTo,
            at: new Date(row.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "sent" as const,
          })),
        })));
      }
      } catch (error) {
        console.error("NEXORA feed hydration failed:", error);
        toast.error("Some feed data could not be loaded. Please refresh to retry.");
      } finally {
        setPostsLoading(false);
      }
    })();
  }, [user]);

  const emit = useCallback((type: string, detail: string) => {
    setEvents((e) => [{ id: uid(), type, detail, at: Date.now() }, ...e].slice(0, 30));
  }, []);

  const toggle = (set: React.Dispatch<React.SetStateAction<Set<string>>>, id: string) =>
    set((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const value: Ctx = useMemo(
    () => ({
      posts,
      postsLoading,
      liked,
      saved,
      reposted,
      conversations,
      balance,
      txns,
      passport,
      online,
      relay,
      events,
      emit,
            toggleLike: (id) => {
        const isCurrentlyLiked = liked.has(id);
        toggle(setLiked, id);
        emit("post.like", id);

        if (!user) return;

        void (async () => {
          try {
            const updatedCount = await (
              isCurrentlyLiked ? unlikePost(id) : likePost(id)
            );
            if (!isCurrentlyLiked) {
              void (supabase as any).rpc("bump_nexora_pillar_affinity", {
                p_post_id: id,
                p_delta: 0.05,
              });
            }

            setPosts((currentPosts) =>
              currentPosts.map((post) =>
                post.id === id
                  ? { ...post, likes: updatedCount }
                  : post,
              ),
            );
          } catch (error) {
            toggle(setLiked, id);
            toast.error("Could not update like state.");
          }
        })();
      },
      toggleSave: async (id) => {
  if (!user) {
    toast.error("Sign in to bookmark posts.");
    return;
  }
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
  toast.error("This sample post cannot be bookmarked yet.");
  return;
  }

  const wasSaved = saved.has(id);
  toggle(setSaved, id);

  try {
    if (wasSaved) {
      const { error } = await (supabase as any)
        .from("user_media_post_bookmarks")
        .delete()
        .eq("user_id", user.id)
        .eq("post_id", id);

      if (error) throw error;
      toast("Removed bookmark");
    } else {
      const { error } = await (supabase as any)
        .from("user_media_post_bookmarks")
        .insert({ user_id: user.id, post_id: id });

      if (error) throw error;
      void (supabase as any).rpc("bump_nexora_pillar_affinity", {
        p_post_id: id,
        p_delta: 0.15,
      });
      toast("Bookmarked");
    }
  } catch (error) {
  toggle(setSaved, id);
  console.error("Bookmark error:", error);

  const message = (error as any)?.message ?? String(error);
  toast.error(`Bookmark error: ${message}`);
  }
},
            addComment: async (id, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        if (!user) {
          toast.error("Sign in to comment.");
          return;
        }

        try {
          const savedCommentId = await addCommentToPost(id, trimmed);

          if (!savedCommentId) {
            throw new Error("Comment was not saved.");
          }

          setPosts((ps) =>
            ps.map((p) =>
              p.id === id
                ? {
                    ...p,
                    comments: [
                      ...p.comments,
{
  id: String(savedCommentId),
  author: passport.handle,
  text: trimmed,
  createdAt: new Date().toISOString(),
},
                    ],
                  }
                : p,
            ),
          );

          emit("post.comment", id);
        } catch (error) {
  console.error("Comment save error:", error);
  const message = (error as any)?.message ?? String(error);
  toast.error(`Comment error: ${message}`);
        }
      },
            share: async (id) => {
        const url =
          typeof window !== "undefined"
            ? `${window.location.origin}/?post=${id}`
            : "";

        if (!navigator.clipboard) {
          toast.error("Clipboard unavailable. Copy the page address from your browser.");
          return;
        }

        try {
          await navigator.clipboard.writeText(url);

          if (user) {
            const updatedCount = await sharePost(id);
            setPosts((ps) =>
              ps.map((p) =>
                p.id === id ? { ...p, shares: updatedCount } : p,
              ),
            );
          }

          toast.success("Link copied to clipboard");
        } catch {
          toast.error("Share could not be completed. Please try again.");
        }
      },

      repost: async (id) => {
        if (!user) {
          toast.error("Sign in to repost.");
          return;
        }

        if (reposted.has(id)) {
          toast("You already reposted this post.");
          return;
        }

        try {
          const updatedCount = await repostPost(id);

          setReposted((current) => new Set(current).add(id));
          setPosts((ps) =>
            ps.map((p) =>
              p.id === id ? { ...p, reposts: updatedCount } : p,
            ),
          );

          toast.success("Reposted to your followers");
          emit("post.repost", id);
        } catch {
          toast.error("Repost could not be saved. Please try again.");
        }
      },
      deletePost: async (id) => {
        if (!user) {
          toast.error("Sign in to delete this post.");
          return false;
        }
        const isDbId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        let r2Keys: string[] = [];
        if (isDbId) {
          // Read storage references before deleting the row; RLS scopes this to the owner.
          const { data: post, error: lookupError } = await (supabase as any)
            .from("user_media_posts")
            .select("id, media_storage_provider, media_storage_key, thumbnail_storage_provider, thumbnail_storage_key")
            .eq("id", id)
            .eq("user_id", user.id)
            .maybeSingle();
          if (lookupError) {
            toast.error(`Could not delete the post: ${lookupError.message}`);
            return false;
          }
          if (!post) {
            toast.error("Could not delete: this post was not found on your account.");
            return false;
          }
          r2Keys = getR2PostObjectKeys(post);

          const { data, error } = await (supabase as any)
            .from("user_media_posts")
            .delete()
            .eq("id", id)
            .eq("user_id", user.id)
            .select("id");
          if (error) {
            toast.error(`Could not delete the post: ${error.message}`);
            return false;
          }
          if (!data?.length) {
            toast.error("Could not delete: this post was not found on your account.");
            return false;
          }
        }

        setPosts((current) => current.filter((post) => post.id !== id));
        emit("post.delete", id);

        if (r2Keys.length) {
          try {
            await cleanupR2MediaObjects({ data: { keys: r2Keys } });
          } catch (cleanupError) {
            console.error("Post deleted but R2 media cleanup failed:", cleanupError);
            toast.error("Post deleted, but its media cleanup failed. Please contact support.");
            return true;
          }
        }

        toast.success("Post deleted");
        return true;
      },
            createPost: (p, draftId, persistedId) => {
        const post: Post = {
          ...p,
             id: persistedId ?? uid(),
          creatorId: "me",
          likes: 0,
          comments: [],
          shares: 0,
          createdAt: "now",
        };
        if (!online) {
          setRelay((r) => [
            ...r,
            {
              id: post.id,
              kind: "post",
              label: p.caption.slice(0, 40) || "New post",
              payload: { post, draftId },
            },
          ]);
          toast("Offline — post queued locally", {
            description: "Session-only. Reconnect and sync before refreshing.",
          });
          return;
        }
        setPosts((ps) => [post, ...ps]);
        if (draftId) removeDraft(draftId);
        emit("post.create", post.id);
        toast.success("Published locally to your feed");
      },
      startConversation: (creatorId) => {
        const existing = conversations.find((c) => c.creatorId === creatorId);
        if (existing) return existing.id;
        const id = uid();
        setConversations((cs) => [...cs, { id, creatorId, ownerId: user?.id, unread: 0, messages: [] }]);
        return id;
      },
      editMessage: (convId, messageId, text) => {
        if (!text.trim()) return;
        setConversations((cs) =>
          cs.map((c) =>
            c.id === convId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId && m.from === "me"
                      ? { ...m, text: text.trim(), edited: true }
                      : m,
                  ),
                }
              : c,
          ),
        );
      },
      deleteMessage: (convId, messageId) => {
        setConversations((cs) =>
          cs.map((c) =>
            c.id === convId
              ? { ...c, messages: c.messages.filter((m) => m.id !== messageId || m.from !== "me") }
              : c,
          ),
        );
        setRelay((r) => r.filter((item) => item.id !== messageId));
      },
      markConversationRead: (convId) =>
        setConversations((cs) =>
          cs.some((c) => c.id === convId && c.unread > 0)
            ? cs.map((c) => (c.id === convId ? { ...c, unread: 0 } : c))
            : cs,
        ),
      sendMessage: (convId, text, attachments = [], replyTo) => {
        if (!preferences.allowMessages)
          throw new Error("Messaging is disabled in your privacy settings.");
        if (!conversations.some((c) => c.id === convId) || !validMessage(text, attachments))
          throw new Error(
            "Message could not be saved. Check the message and attachments, then try again.",
          );
        const msg = {
          id: uid(),
          from: "me" as const,
          text,
          attachments,
          replyTo,
          at: now(),
          status: online ? ("sending" as const) : ("queued" as const),
        };
        setConversations((cs) =>
          cs.map((c) =>
            c.id === convId ? { ...c, unread: 0, messages: [...c.messages, msg] } : c,
          ),
        );
        if (!online) {
          setRelay((r) => [
            ...r,
            {
              id: msg.id,
              kind: "message",
              label: text.slice(0, 40) || attachments[0]?.name || "Attachment",
              payload: { convId },
            },
          ]);
          return;
        }
        if (user) {
          void (supabase as any)
            .from("message_threads")
            .insert({
              conversation_key: convId,
              sender_id: user.id,
              body: text.trim(),
              metadata: { attachments, replyTo, owner_id: user.id },
            })
            .then(({ error }: { error: unknown }) => {
              if (error) toast.error("Message could not be saved to your account.");
            });
        }
        emit("message.send", convId);
        setTimeout(() => {
          setConversations((cs) =>
            cs.map((c) =>
              c.id === convId
                ? {
                    ...c,
                    messages: c.messages.map((m) =>
                      m.id === msg.id ? { ...m, status: "sent" as const } : m,
                    ),
                  }
                : c,
            ),
          );
        }, 450);
      },
      sendMoney: (to, amount, note) => {
        setBalance((b) => b - amount);
        setTxns((t) => [
          {
            id: uid(),
            label: `Sent to ${to}${note ? ` — ${note}` : ""}`,
            amount: -amount,
            at: `Today, ${now()}`,
            kind: "out",
          },
          ...t,
        ]);
        emit("wallet.send", `${amount}`);
      },
      creditWallet: (amount, label) => {
        setBalance((b) => b + amount);
        setTxns((t) => [
          {
            id: uid(),
            label,
            amount,
            at: `Today, ${now()}`,
            kind: "in" as const,
          },
          ...t,
        ]);
        emit("wallet.topup", `${amount}`);
      },
      updatePassport: (p) => setPassport((x) => ({ ...x, ...p })),
      setOnline: (v) => {
        setOnlineState(v);
        toast(v ? "Back online" : "Offline mode (simulated)");
      },
      syncRelay: () => {
        if (!online || !relay.length) return;
        relay.forEach((item) => {
          if (item.kind === "post") {
            const { post, draftId } = item.payload as { post: Post; draftId?: string };
            setPosts((ps) => (ps.some((p) => p.id === post.id) ? ps : [post, ...ps]));
            if (draftId) removeDraft(draftId);
          }
          if (item.kind === "message") {
            setConversations((cs) =>
              cs.map((c) => ({
                ...c,
                messages: c.messages.map((m) => (m.id === item.id ? { ...m, status: "sent" } : m)),
              })),
            );
          }
        });
        toast.success(`Relay synced ${relay.length} item${relay.length > 1 ? "s" : ""}`);
        notify(
          "Offline Relay synced locally",
          `${relay.length} queued items saved in this session. No external delivery.`,
        );
        emit("relay.sync", `${relay.length}`);
        setRelay([]);
      },
    }),
    [
      posts,
      liked,
      saved,
      reposted,
      conversations,
      balance,
      txns,
      passport,
      online,
      relay,
      events,
      emit,
      preferences.allowMessages,
      notify,
      removeDraft,
      user,
    ],
  );

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp must be inside AppProvider");
  return c;
}

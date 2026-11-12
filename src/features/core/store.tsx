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
  seedConversations,
  seedPosts,
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
  const [posts, setPosts] = useState(seedPosts);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState<Set<string>>(new Set(["p4"]));
  const [reposted, setReposted] = useState<Set<string>>(new Set());
  const [conversations, setConversations] = useState(seedConversations);
  const [balance, setBalance] = useState(24680.5);
  const [txns, setTxns] = useState(seedTxns);
  const [online, setOnlineState] = useState(true);
  const [relay, setRelay] = useState<RelayItem[]>([]);
  const [events, setEvents] = useState<AppEvent[]>([]);
  const [passport, setPassport] = useState<Passport>({
    name: "Samwel Nyabari",
    handle: "samwel.nx",
    bio: "Builder · storyteller · Nairobi",
    reputation: 82,
    interests: ["city", "food", "tech", "music"],
    share: { interests: true, location: false, reputation: true, activity: false },
  });

  useEffect(() => {
    setConversations(user ? [] : seedConversations);
    if (!user) return;
    void (async () => {
            const [
        { data: savedPosts },
        { data: savedMessages },
                { data: myLikedPostIds },
        myRepostedPostIds,
        { data: savedComments },
        ] = await Promise.all([
        (supabase as any)
          .from("user_media_posts")
          .select(
            "id, user_id, caption, media_url, media_type, audience, tags, created_at, like_count, share_count, repost_count, comment_count, view_count",
          )
          .order("created_at", { ascending: false }),
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
      if (savedPosts?.length) {
        const hydratedPosts = await Promise.all(
          savedPosts.map(async (row: any) => {
            let image: string | undefined;
            const media = row.media_url ?? undefined;
            if (media) {
              if (/^https?:\/\//i.test(media)) {
                image = media;
              } else {
                const { data } = await supabase.storage.from("post-media").createSignedUrl(media, 3600);
                image = data?.signedUrl ?? undefined;
              }
            }
            return {
              id: row.id,
              creatorId: row.user_id === user.id ? "me" : (row.user_id ?? "me"),
              caption: row.caption ?? "",
              image,
              mediaType: row.media_type ?? undefined,
              audience: row.audience ?? "public",
              tags: row.tags ?? [],
              filter: "original",
              format: "landscape",
              likes: Number(row.like_count ?? 0),
                            comments: (savedComments ?? [])
                .filter((comment: any) => comment.post_id === row.id)
                .map((comment: any) => ({
                  id: comment.id,
                  author: comment.user_id === user.id ? passport.handle : "member",
                  text: comment.text,
                })),
              shares: Number(row.share_count ?? 0),
              createdAt: new Date(row.created_at).toLocaleDateString(),
            } as unknown as Post;
          }),
        );
        setPosts((current) => [
          ...hydratedPosts,
          ...current.filter((post) => !savedPosts.some((row: any) => row.id === post.id)),
        ]);
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
      toggleSave: (id) => {
        toggle(setSaved, id);
        toast(saved.has(id) ? "Removed bookmark" : "Bookmarked");
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
                      },
                    ],
                  }
                : p,
            ),
          );

          emit("post.comment", id);
        } catch (error) {
          toast.error("Comment could not be saved. Please try again.");
        }
      },
      share: async (id) => {
        setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, shares: p.shares + 1 } : p)));
        if (user) {
          try {
            await sharePost(id);
          } catch {
            toast.error("Share count could not be updated.");
          }
        }
        const url = typeof window !== "undefined" ? `${window.location.origin}/?post=${id}` : "";
        if (!navigator.clipboard) {
          toast.error("Clipboard unavailable. Copy the page address from your browser.");
          return;
        }
        try {
          await navigator.clipboard.writeText(url);
          toast.success("Link copied to clipboard");
        } catch {
          toast.error("Could not copy link. Check clipboard permissions.");
        }
      },
      repost: async (id) => {
        if (reposted.has(id)) {
          toast("You already reposted this video.");
          return;
        }
        setReposted((current) => new Set(current).add(id));
        if (user) {
          try {
            await sharePost(id);
          } catch {
            toast.error("Repost count could not be updated.");
          }
        }
        setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, shares: p.shares + 1 } : p)));
        toast.success("Reposted to your followers");
        emit("post.repost", id);
      },
      deletePost: async (id) => {
        if (!user) {
          toast.error("Sign in to delete this post.");
          return false;
        }
        const { error } = await (supabase as any)
          .from("user_media_posts")
          .delete()
          .eq("id", id)
          .eq("user_id", user.id);
        if (error) {
          toast.error("Could not delete the post.");
          return false;
        }
        setPosts((current) => current.filter((post) => post.id !== id));
        emit("post.delete", id);
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

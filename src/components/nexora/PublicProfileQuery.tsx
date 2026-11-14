
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, UserPlus, UserCheck, Heart, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSocialGraph } from "@/features/social/useSocialGraph";

type PublicProfileRecord = {
  id: string;
  display_name: string | null;
  handle: string;
  bio: string | null;
  private_profile: boolean;
  settings: Record<string, unknown> | null;
  avatar_url: string | null;
  account_type: string | null;
  profile_category: string | null;
};

type PublicPost = {
  id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  tags: string[] | null;
  created_at: string;
  audience: string | null;
};

export function PublicProfileQuery({ handle }: { handle: string }) {
  const { user } = useSession();

  const [profile, setProfile] =
    useState<PublicProfileRecord | null>(null);

  const [posts, setPosts] = useState<PublicPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [postsLoading, setPostsLoading] = useState(false);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
const [likedMedia, setLikedMedia] = useState<string[]>([]);
const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
const [shareCounts, setShareCounts] = useState<Record<string, number>>({});
const [likeBusy, setLikeBusy] = useState<string[]>([]);
  const [heartVisible, setHeartVisible] = useState(false);
const touchStart = useRef({ x: 0, y: 0 });
const lastTap = useRef(0);
const heartTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
 const [commentsOpen, setCommentsOpen] = useState(false);
  const [postComments, setPostComments] = useState<
  { id: string; user_id: string; content: string; created_at: string; display_name?: string | null; handle?: string | null; avatar_url?: string | null }[]
>([]);
const [commentText, setCommentText] = useState("");
const [commentsLoading, setCommentsLoading] = useState(false);
  const mediaPosts = posts.filter((post) => !!post.media_url);
 async function loadPostComments(postId: string) {
  setCommentsLoading(true);

  const { data, error } = await (supabase as any)
    .from("post_comments")
    .select("id, user_id, content, created_at")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Could not load comments:", error);
    toast.error("Could not load comments.");
    setCommentsLoading(false);
    return;
  }

  const comments = data ?? [];
  const userIds = [...new Set(comments.map((comment: any) => comment.user_id).filter(Boolean))];
  let profileById: Record<string, { display_name: string | null; handle: string | null; avatar_url: string | null }> = {};
  if (userIds.length) {
    const { data: profiles, error: profilesError } = await (supabase as any)
      .from("profiles")
      .select("id, display_name, handle, avatar_url")
      .in("id", userIds);
    if (profilesError) {
      console.error("Could not load comment authors:", profilesError);
    } else {
      profileById = Object.fromEntries((profiles ?? []).map((item: any) => [item.id, item]));
    }
  }
  setPostComments(comments.map((comment: any) => ({
    ...comment,
    display_name: profileById[comment.user_id]?.display_name ?? null,
    handle: profileById[comment.user_id]?.handle ?? null,
    avatar_url: profileById[comment.user_id]?.avatar_url ?? null,
  })));
  setCommentsLoading(false);
 }
  async function submitPostComment(postId: string) {
  const content = commentText.trim();

  if (!user) {
    toast.error("Sign in to comment.");
    return;
  }

  if (!content) return;

  const { error } = await (supabase as any)
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
    });

  if (error) {
    toast.error("Could not add your comment.");
    return;
  }

  setCommentText("");
  setCommentCounts((current) => ({ ...current, [postId]: (current[postId] || 0) + 1 }));
  await loadPostComments(postId);
  toast.success("Comment added.");
  }
  async function sharePublicPost(post: PublicPost) {
  const shareUrl = `${window.location.origin}/profile?handle=${encodeURIComponent(handle)}`;
  let shared = false;

  try {
    if (navigator.share) {
      await navigator.share({
        title: "NEXORA post",
        text: post.caption || "Check out this post on NEXORA",
        url: shareUrl,
      });
      shared = true;
    } else {
      await navigator.clipboard.writeText(shareUrl);
      shared = true;
      toast.success("Post link copied.");
    }
  } catch (error) {
    if ((error as Error).name !== "AbortError") {
      toast.error("Could not share this post.");
    }
  }

  if (shared && user) {
    const { error } = await (supabase as any)
      .from("post_interactions")
      .insert({ post_id: post.id, actor_id: user.id, kind: "share" });
    if (!error) {
      setShareCounts((current) => ({ ...current, [post.id]: (current[post.id] || 0) + 1 }));
    } else if (error.code !== "23505") {
      console.error("Could not record share:", error);
    }
  }
  }
  useEffect(() => {
  async function loadEngagementCounts() {
    if (posts.length === 0) {
      setLikeCounts({});
      setCommentCounts({});
      setShareCounts({});
      setLikedMedia([]);
      return;
    }

    const postIds = posts.map((post) => post.id);
    const [interactionsResult, commentsResult] = await Promise.all([
      (supabase as any)
        .from("post_interactions")
        .select("post_id, actor_id, kind")
        .in("post_id", postIds)
        .in("kind", ["like", "share"]),
      (supabase as any)
        .from("post_comments")
        .select("post_id")
        .in("post_id", postIds),
    ]);

    if (interactionsResult.error) {
      console.error("Could not load post interactions:", interactionsResult.error);
    } else {
      const likes: Record<string, number> = {};
      const shares: Record<string, number> = {};
      const mine: string[] = [];
      for (const row of interactionsResult.data ?? []) {
        if (row.kind === "like") {
          likes[row.post_id] = (likes[row.post_id] || 0) + 1;
          if (user?.id && row.actor_id === user.id) mine.push(row.post_id);
        } else if (row.kind === "share") {
          shares[row.post_id] = (shares[row.post_id] || 0) + 1;
        }
      }
      setLikeCounts(likes);
      setShareCounts(shares);
      setLikedMedia(mine);
    }

    if (commentsResult.error) {
      console.error("Could not load comment counts:", commentsResult.error);
    } else {
      const counts: Record<string, number> = {};
      for (const row of commentsResult.data ?? []) {
        counts[row.post_id] = (counts[row.post_id] || 0) + 1;
      }
      setCommentCounts(counts);
    }
  }

  void loadEngagementCounts();
}, [posts, user?.id]);
  async function likeMedia(post: PublicPost, onlyLike = false) {
  if (!user) {
    toast.error("Sign in to like posts.");
    return;
  }
  if (likeBusy.includes(post.id)) return;

  const alreadyLiked = likedMedia.includes(post.id);
  if (alreadyLiked && onlyLike) return;

  setLikeBusy((current) => [...current, post.id]);
  try {
    if (alreadyLiked) {
      const { error } = await (supabase as any)
        .from("post_interactions")
        .delete()
        .eq("post_id", post.id)
        .eq("actor_id", user.id)
        .eq("kind", "like");
      if (error) {
        toast.error("Could not unlike this post.");
        return;
      }
      setLikedMedia((current) => current.filter((id) => id !== post.id));
      setLikeCounts((current) => ({ ...current, [post.id]: Math.max(0, (current[post.id] || 0) - 1) }));
    } else {
      const { error } = await (supabase as any)
        .from("post_interactions")
        .insert({ post_id: post.id, actor_id: user.id, kind: "like" });
      if (error && error.code !== "23505") {
        toast.error("Could not like this post.");
        return;
      }
      if (!error) {
        setLikeCounts((current) => ({ ...current, [post.id]: (current[post.id] || 0) + 1 }));
      }
      setLikedMedia((current) => current.includes(post.id) ? current : [...current, post.id]);
    }
  } finally {
    setLikeBusy((current) => current.filter((id) => id !== post.id));
  }
  }
  function handleMediaTouchStart(event: React.TouchEvent<HTMLDivElement>) {
  const touch = event.touches[0];
  touchStart.current = {
    x: touch.clientX,
    y: touch.clientY,
  };
}

function handleMediaTouchEnd(
  event: React.TouchEvent<HTMLDivElement>,
  post: PublicPost
) {
  const touch = event.changedTouches[0];
  const dx = touch.clientX - touchStart.current.x;
  const dy = touch.clientY - touchStart.current.y;

  if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) {
    setActiveMediaIndex((index) => {
      if (index === null) return 0;
      return dx < 0
        ? Math.min(mediaPosts.length - 1, index + 1)
        : Math.max(0, index - 1);
    });
    lastTap.current = 0;
    return;
  }

  if (dy > 80 && Math.abs(dy) > Math.abs(dx)) {
    setActiveMediaIndex(null);
    lastTap.current = 0;
    return;
  }

  if (Math.abs(dx) < 15 && Math.abs(dy) < 15) {
    const now = Date.now();

    if (now - lastTap.current < 300) {
      void likeMedia(post, true);
      setHeartVisible(true);

      if (heartTimeout.current) {
        window.clearTimeout(heartTimeout.current);
      }

      heartTimeout.current = window.setTimeout(() => {
        setHeartVisible(false);
      }, 800);

      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  }
}
  useEffect(() => {
  return () => {
    if (heartTimeout.current) {
      window.clearTimeout(heartTimeout.current);
    }
  };
}, []);
  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");
      setProfile(null);
      setPosts([]);

      const { data, error: fetchError } = await (supabase as any)
        .rpc("get_public_profile", { p_handle: handle });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || "Unable to load this profile.");
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        setError("This profile does not exist or is not publicly available.");
        setLoading(false);
        return;
      }

      setProfile(row as PublicProfileRecord);
      setLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  const isOwner = Boolean(user && profile && user.id === profile.id);
  const graph = useSocialGraph(profile?.id);

  useEffect(() => {
    let cancelled = false;

    async function loadPosts() {
      if (!profile || (profile.private_profile && !isOwner)) {
        setPosts([]);
        return;
      }

      setPostsLoading(true);

      const { data, error: postsError } = await (supabase as any)
        .from("posts")
        .select("id, caption, media_url, media_type, tags, created_at, audience")
        .eq("author_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(60);

      if (cancelled) return;

      if (postsError) {
        toast.error("Could not load public posts.");
        setPosts([]);
      } else {
        const visiblePosts = (data ?? []).filter(
          (post: PublicPost) => isOwner || post.audience !== "private"
        );
        setPosts(visiblePosts);
      }

      setPostsLoading(false);
    }

    void loadPosts();

    return () => {
      cancelled = true;
    };
  }, [profile, isOwner]);

  async function handleFollow() {
    if (!user || isOwner || followBusy) return;

    setFollowBusy(true);

    try {
      await graph.toggleFollow();
    } finally {
      setFollowBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        Loading public profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8 text-center">
        <h2 className="text-xl font-bold">Profile unavailable</h2>
        <p className="text-sm text-muted-foreground">
          {error || "This profile could not be found."}
        </p>
        <a href="/profile" className="text-primary underline">
  Return to my profile
</a>
      </div>
    );
  }

  const displayName = profile.display_name || "NEXORA User";
<p className="text-xs text-red-500">
  Debug recipient ID: {profile.id || "MISSING"}
</p>
  console.log("NEXORA PROFILE CHECK:", {
  id: profile.id,
  handle: profile.handle,
});
  return (
    <main className="mx-auto max-w-3xl space-y-5 p-4">

      <a href="/profile" className="text-sm text-primary underline">
  ← Back to profile
</a>

      <section className="rounded-2xl border bg-card p-5 sm:p-6">

        <div className="flex flex-wrap items-start gap-4">

          {profile.avatar_url ? (
            <img
              src={profile.avatar_url}
              alt={displayName}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-primary"
            />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-3xl font-bold">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold">
              {displayName}
            </h1>

            <p className="text-sm text-muted-foreground">
              @{profile.handle}
            </p>

            {(profile.account_type === "creator" ||
              profile.account_type === "business") && (
              <span className="mt-2 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                {profile.account_type === "creator" ? "Creator" : "Business"}
                {profile.profile_category
                  ? ` · ${profile.profile_category}`
                  : ""}
              </span>
            )}
          </div>

        </div>

        <p className="mt-4 whitespace-pre-wrap text-sm">
          {profile.bio || "No bio added yet."}
        </p>

        <div className="mt-5 flex flex-wrap gap-5 border-t pt-4 text-sm">
          <span>
            <strong>{graph.followers.toLocaleString()}</strong> Followers
          </span>

          <span>
            <strong>{graph.following.toLocaleString()}</strong> Following
          </span>
        </div>

        {!isOwner && (
          <div className="mt-5 flex flex-wrap gap-2">

            {user ? (
              <Button
                onClick={() => void handleFollow()}
                disabled={followBusy || graph.loading}
              >
                {graph.isFollowing ? (
                  <UserCheck className="mr-2 h-4 w-4" />
                ) : (
                  <UserPlus className="mr-2 h-4 w-4" />
                )}

                {followBusy
                  ? "Please wait..."
                  : graph.isFollowing
                    ? "Following"
                    : "Follow"}
              </Button>
            ) : (
              <Button asChild>
                <Link to="/auth">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Sign in to follow
                </Link>
              </Button>
            )}

            <Button variant="outline" asChild>
  <Link
    to="/messages"
    search={{
      recipient: profile.id,
      returnTo: `/profile?handle=${encodeURIComponent(profile.handle)}`,
    }}
  >
    <MessageCircle className="mr-2 h-4 w-4" />
    Message
  </Link>
</Button>

          </div>
        )}

      </section>

      <section className="space-y-3">

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">
            Public posts & Reels
          </h2>

          <span className="text-xs text-muted-foreground">
            {posts.length} posts
          </span>
        </div>

        {profile.private_profile && !isOwner ? (
          <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
            This account is private.
          </div>
        ) : postsLoading ? (
          <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
            Loading posts...
          </div>
        ) : posts.length === 0 ? (
          <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
            No public posts yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

            {posts.map((post) => (
              <article
  key={post.id}
  onClick={() => {
    const index = mediaPosts.findIndex((item) => item.id === post.id);
    if (index !== -1) setActiveMediaIndex(index);
  }}
  className="cursor-pointer overflow-hidden rounded-xl border bg-card"
>

                {post.media_url &&
                (post.media_type || "").startsWith("video/") ? (
                  <video
                    src={post.media_url}
                    
                    playsInline
                    className="aspect-[4/5] w-full bg-muted object-cover"
                  />
                ) : post.media_url ? (
                  <img
                    src={post.media_url}
                    alt={post.caption || "Public post"}
                    loading="lazy"
                    className="aspect-[4/5] w-full bg-muted object-cover"
                  />
                ) : null}

                <div className="space-y-2 p-3">
                  <p className="line-clamp-3 text-sm">
                    {post.caption || ""}
                  </p>

                  <p className="text-xs text-muted-foreground">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>

                  {!!post.tags?.length && (
                    <p className="line-clamp-1 text-xs text-accent">
                      {post.tags.map((tag) => `#${tag}`).join(" ")}
                    </p>
                  )}
                </div>

              </article>
            ))}

          </div>
        )}

      </section>
{activeMediaIndex !== null && mediaPosts[activeMediaIndex] && (
  <div
    className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-3"
    onClick={() => setActiveMediaIndex(null)}
  >
    <button
      type="button"
      onClick={() => setActiveMediaIndex(null)}
      className="absolute right-5 top-5 z-10 rounded-full bg-white/15 px-4 py-2 text-white"
    >
      Close ✕
    </button>

    <button
      type="button"
      disabled={activeMediaIndex === 0}
      onClick={(event) => {
        event.stopPropagation();
        setActiveMediaIndex((index) =>
          index === null ? 0 : Math.max(0, index - 1)
        );
      }}
      className="absolute left-3 z-10 rounded-full bg-white/15 px-4 py-3 text-white disabled:opacity-30"
    >
      ←
    </button>
    <div
  className="relative flex h-[85vh] w-full max-w-5xl flex-col items-center justify-center gap-3"
  onClick={(event) => event.stopPropagation()}
  onTouchStart={handleMediaTouchStart}
  onTouchEnd={(event) =>
    handleMediaTouchEnd(event, mediaPosts[activeMediaIndex])
  }
>
    
      {(mediaPosts[activeMediaIndex].media_type || "").startsWith("video/") ? (
        <video
          key={mediaPosts[activeMediaIndex].id}
          src={mediaPosts[activeMediaIndex].media_url}
          controls
          autoPlay
          playsInline
          className="max-h-[75vh] max-w-full rounded-lg"
        />
      ) : (
        <img
          src={mediaPosts[activeMediaIndex].media_url}
          alt={mediaPosts[activeMediaIndex].caption || "Public post"}
          className="max-h-[75vh] max-w-full rounded-lg object-contain"
        />
      )}

      {heartVisible && (
  <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
    <span className="animate-ping text-7xl text-red-500">♥</span>
  </div>
)}
  <p className="max-w-xl text-center text-sm text-white">
        {mediaPosts[activeMediaIndex].caption || ""}
      </p>

      <p className="text-xs text-white/60">
        {activeMediaIndex + 1} / {mediaPosts.length}
      </p>
<div className="absolute right-2 top-1/2 z-30 flex -translate-y-1/2 flex-col items-center gap-6 text-white">
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      void likeMedia(mediaPosts[activeMediaIndex]);
    }}
    className="flex flex-col items-center gap-1"
  >
    <span className="rounded-full bg-black/50 p-3">
      <Heart
        className={`h-7 w-7 ${
          likedMedia.includes(mediaPosts[activeMediaIndex].id)
            ? "fill-red-500 text-red-500"
            : ""
        }`}
      />
    </span>
    <span className="text-xs">
      {likeCounts[mediaPosts[activeMediaIndex].id] ?? 0}
    </span>
  </button>

  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      setCommentsOpen(true);
setCommentText("");
void loadPostComments(mediaPosts[activeMediaIndex].id);
    }}
    className="flex flex-col items-center gap-1"
  >
    <span className="rounded-full bg-black/50 p-3">
      <MessageCircle className="h-7 w-7" />
    </span>
    <span className="text-xs">{commentCounts[mediaPosts[activeMediaIndex].id] ?? 0}</span>
  </button>

  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();
      void sharePublicPost(mediaPosts[activeMediaIndex]);
    }}
    className="flex flex-col items-center gap-1"
  >
    <span className="rounded-full bg-black/50 p-3">
      <Share2 className="h-7 w-7" />
    </span>
    <span className="text-xs">{shareCounts[mediaPosts[activeMediaIndex].id] ?? 0}</span>
  </button>
</div>
 {commentsOpen && (
  <div
    className="fixed inset-0 z-[120] flex items-end justify-center bg-black/80 p-3 sm:items-center"
    onClick={() => setCommentsOpen(false)}
  >
    <div
      className="flex max-h-[80vh] w-full max-w-xl flex-col rounded-2xl bg-zinc-950 p-4 text-white"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex shrink-0 items-center justify-between border-b border-white/20 pb-3">
        <h3 className="text-lg font-semibold">Comments</h3>
        <button
          type="button"
          onClick={() => setCommentsOpen(false)}
          className="rounded-full bg-white/10 px-3 py-2"
        >
          Close ✕
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto py-3">
        {commentsLoading ? (
          <p className="text-sm text-white/60">Loading comments...</p>
        ) : postComments.length === 0 ? (
          <p className="text-sm text-white/60">No comments yet. Be the first!</p>
        ) : (
          postComments.map((comment) => (
            <div key={comment.id} className="rounded-lg bg-white/10 p-3">
              <p className="text-xs text-white/60">
                <span className="font-semibold">{comment.display_name || (comment.handle ? `@${comment.handle}` : "NEXORA User")}</span>{comment.handle ? ` · @${comment.handle}` : ""}
              </p>
              <p className="break-words text-sm">{comment.content}</p>
            </div>
          ))
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void submitPostComment(mediaPosts[activeMediaIndex!].id);
        }}
        className="flex shrink-0 gap-2 border-t border-white/20 pt-3"
      >
        <input
          value={commentText}
          onChange={(event) => setCommentText(event.target.value)}
          placeholder="Write a comment..."
          maxLength={2000}
          className="min-w-0 flex-1 rounded-lg bg-white/15 px-3 py-3 text-sm text-white placeholder:text-white/50"
        />
        <button
          type="submit"
          disabled={!commentText.trim() || commentsLoading}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  </div>
)}   
</div>

    <button
      type="button"
      disabled={activeMediaIndex === mediaPosts.length - 1}
      onClick={(event) => {
        event.stopPropagation();
        setActiveMediaIndex((index) =>
          index === null
            ? 0
            : Math.min(mediaPosts.length - 1, index + 1)
        );
      }}
      className="absolute right-3 z-10 rounded-full bg-white/15 px-4 py-3 text-white disabled:opacity-30"
    >
      →
    </button>
  </div>
)}
      <p className="pb-4 text-center text-xs text-muted-foreground">
        NEXORA Public Profile
      </p>

    </main>
  );
        }

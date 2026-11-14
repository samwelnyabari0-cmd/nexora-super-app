
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { MessageCircle, UserPlus, UserCheck } from "lucide-react";
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
  const [heartVisible, setHeartVisible] = useState(false);
const touchStart = useRef({ x: 0, y: 0 });
const lastTap = useRef(0);
const heartTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState<number | null>(null);
  const mediaPosts = posts.filter((post) => !!post.media_url);
  async function likeMedia(post: PublicPost) {
  if (!user) {
    toast.error("Sign in to like posts.");
    return;
  }

  if (likedMedia.includes(post.id)) return;

  const { error: likeError } = await (supabase as any)
    .from("post_interactions")
    .insert({
      post_id: post.id,
      actor_id: user.id,
      kind: "like",
    });

  if (likeError && likeError.code !== "23505") {
    toast.error("Could not like this post.");
    return;
  }

  setLikedMedia((current) =>
    current.includes(post.id) ? current : [...current, post.id]
  );
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
      void likeMedia(post);
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
  className="relative flex max-h-[85vh] max-w-5xl flex-col items-center gap-3"
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

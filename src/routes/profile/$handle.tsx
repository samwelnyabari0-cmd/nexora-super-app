import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bookmark,
  Film,
  Grid3X3,
  Heart,
  LockKeyhole,
  MessageCircle,
  Repeat2,
  Share2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSocialGraph } from "@/features/social/useSocialGraph";

type ProfileRecord = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  settings?: Record<string, unknown> | null;
};

type ProfilePost = {
  id: string;
  author_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  audience: string | null;
  tags: string[] | null;
  created_at: string;
  mediaSrc?: string;
  likes: number;
  comments: number | null;
  shares: number;
  views: number | null;
};

type Tab = "posts" | "reels" | "videos" | "collabs" | "reposts";
type SocialTab = "followers" | "following";

export const Route = createFileRoute("/profile/$handle")({
  head: () => ({
    meta: [
      { title: "Profile & Pulse Passport — NEXORA" },
      { name: "description", content: "Explore a NEXORA creator's public Pulse Passport and posts." },
    ],
  }),
  component: PublicProfile,
});

const contentTabs: { id: Tab; label: string; Icon: typeof Grid3X3 }[] = [
  { id: "posts", label: "Posts", Icon: Grid3X3 },
  { id: "reels", label: "Reels", Icon: Film },
  { id: "videos", label: "Videos", Icon: Video },
  { id: "collabs", label: "Collabs", Icon: Users },
  { id: "reposts", label: "Reposts", Icon: Repeat2 },
];

function PublicProfile() {
  const { handle } = Route.useParams();
  const { user } = useSession();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("posts");
  const [socialTab, setSocialTab] = useState<SocialTab | null>(null);
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);
  const [showCreatorInsights, setShowCreatorInsights] = useState(false);
  const [connections, setConnections] = useState<
    Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>
  >([]);

  const owner = Boolean(user && profile && user.id === profile.id);
  const privateProfile = Boolean(
    profile?.settings?.privateProfile === true || profile?.settings?.private_profile === true,
  );
  const graph = useSocialGraph(profile?.id);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setProfile(null);
    setPosts([]);

    void (async () => {
      const { data: row, error: profileError } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, handle, avatar_url, settings")
        .ilike("handle", handle)
        .maybeSingle();

      if (cancelled) return;
      if (profileError || !row) {
        setError("This profile could not be found or is not available.");
        setLoading(false);
        return;
      }

      const found = row as ProfileRecord;
      setProfile(found);
      const isOwner = user?.id === found.id;
      const isPrivate =
        found.settings?.privateProfile === true || found.settings?.private_profile === true;

      // Don't request private posts or media for non-owners. Database RLS remains authoritative.
      if (isPrivate && !isOwner) {
        setLoading(false);
        return;
      }

      const { data: rows, error: postsError } = await (supabase as any)
        .from("posts")
        .select("id, author_id, caption, media_url, media_type, audience, tags, created_at")
        .eq("author_id", found.id)
        .order("created_at", { ascending: false })
        .limit(60);

      if (cancelled) return;
      if (postsError) {
        setError("Posts are temporarily unavailable.");
        setLoading(false);
        return;
      }

      const visibleRows = (rows ?? []).filter(
        (post: ProfilePost) => isOwner || post.audience !== "private",
      );
      const postIds = visibleRows.map((post: ProfilePost) => post.id);
      let interactionRows: Array<{ post_id: string; kind: string }> = [];

      if (postIds.length) {
        const { data } = await (supabase as any)
          .from("post_interactions")
          .select("post_id, kind")
          .in("post_id", postIds);
        interactionRows = data ?? [];
      }

      const hydrated = await Promise.all(
        visibleRows.map(async (post: ProfilePost) => {
          let mediaSrc: string | undefined;
          if (post.media_url) {
            if (/^https?:\/\//i.test(post.media_url)) {
              mediaSrc = post.media_url;
            } else {
              const { data } = await supabase.storage
                .from("post-media")
                .createSignedUrl(post.media_url, 900);
              mediaSrc = data?.signedUrl ?? undefined;
            }
          }

          const events = interactionRows.filter((event) => event.post_id === post.id);
          return {
            ...post,
            mediaSrc,
            likes: events.filter((event) => event.kind === "like").length,
            comments: null,
            shares: events.filter((event) => event.kind === "share").length,
            views: null,
          };
        }),
      );

      if (!cancelled) {
        setPosts(hydrated);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, user?.id]);

  useEffect(() => {
    let cancelled = false;
    if (!profile || !socialTab || !owner) {
      setConnections([]);
      return;
    }

    void (async () => {
      const column = socialTab === "followers" ? "follower_id" : "following_id";
      const relationColumn = socialTab === "followers" ? "following_id" : "follower_id";
      const { data: rows } = await (supabase as any)
        .from("follows")
        .select(column)
        .eq(relationColumn, profile.id)
        .limit(100);
      const ids = (rows ?? []).map((row: Record<string, string>) => row[column]).filter(Boolean);

      if (!ids.length) {
        if (!cancelled) setConnections([]);
        return;
      }

      const { data } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, handle, avatar_url")
        .in("id", ids);
      if (!cancelled) setConnections(data ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [profile?.id, socialTab, owner]);

  const visiblePosts = useMemo(() => {
    const isVideo = (post: ProfilePost) => post.media_type?.startsWith("video/") === true;
    const isReel = (post: ProfilePost) =>
      isVideo(post) && post.tags?.some((tag) => ["reel", "short"].includes(tag.toLowerCase()));

    switch (tab) {
      case "posts":
        return posts.filter((post) => !isVideo(post));
      case "reels":
        return posts.filter(isReel);
      case "videos":
        return posts.filter((post) => isVideo(post) && !isReel(post));
      case "collabs":
        return posts.filter((post) => post.tags?.some((tag) => tag.toLowerCase() === "collab"));
      case "reposts":
        return [];
      default:
        return posts;
    }
  }, [posts, tab]);

  const totalLikes = posts.reduce((total, post) => total + post.likes, 0);
  const totalShares = posts.reduce((total, post) => total + post.shares, 0);
  const totalCollabs = posts.filter((post) => post.tags?.some((tag) => tag.toLowerCase() === "collab")).length;

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl p-4 text-sm text-muted-foreground" role="status">
        Loading Pulse Passport…
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-3xl p-4">
        <Button asChild variant="ghost">
          <Link to="/profile"><ArrowLeft className="mr-2 h-4 w-4" /> Back to profile</Link>
        </Button>
        <p className="mt-6 text-sm text-muted-foreground">{error || "Profile unavailable."}</p>
      </div>
    );
  }

  const displayName = profile.display_name || profile.handle || "NEXORA member";
  const setSocial = (value: SocialTab) =>
    setSocialTab((current) => (current === value ? null : value));

  async function shareProfile() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: `${displayName} on NEXORA`, url });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        toast.success("Profile link copied");
      }
    } catch (reason) {
      if ((reason as DOMException).name !== "AbortError") {
        toast.error("Unable to share this profile.");
      }
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl space-y-3 bg-slate-950 pb-20 text-slate-100" aria-label={`${displayName}'s profile`}>
      {/* Compact social profile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/95 px-4 py-2 backdrop-blur">
        <Link to="/" className="font-display text-sm font-bold tracking-wider">NEXORA</Link>
        <span className="text-[11px] text-slate-400">{owner ? "Your Pulse Passport" : "Public profile"}</span>
        <div className="flex items-center gap-2">
          <Button asChild size="sm" variant="outline"><Link to="/notifications" aria-label="Notifications">🔔</Link></Button>
          <Button asChild size="sm" variant="outline"><Link to="/live">(( LIVE ))</Link></Button>
        </div>
      </header>

      <section className="space-y-3 border-b border-slate-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover ring-2 ring-indigo-500" />
            ) : (
              <Avatar name={displayName} size={48} ring />
            )}
            <div className="min-w-0">
              <h1 className="truncate text-base font-bold">@{profile.handle || handle}</h1>
              <p className="truncate text-xs text-slate-300">{displayName}</p>
            </div>
          </div>
          {owner && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">🟢 Online</span>}
        </div>
        <p className="text-xs text-slate-300">Building Nexora Super-App Ecosystem | Dev &amp; Creator</p>
        <div className="flex gap-2 pt-1">
          {owner ? (
            <>
              <Button asChild size="sm" className="flex-1 bg-indigo-600"><Link to="/profile">✏️ Edit Profile</Link></Button>
              <Button size="sm" variant="outline" className="flex-1" onClick={() => void shareProfile()}>🔗 Share Profile</Button>
            </>
          ) : (
            <Button size="sm" className="w-full bg-indigo-600" onClick={() => void graph.toggleFollow()} disabled={graph.loading || !user}>
              {!user ? "Sign in to follow" : graph.isFollowing ? "Following" : "Follow Account"}
            </Button>
          )}
        </div>
      </section>

      {/* Pulse Passport compact stats */}
      <section className="mx-4 rounded-2xl border border-slate-800 bg-slate-900 p-3" aria-label="Pulse Passport stats">
        <h2 className="mb-3 text-xs font-semibold">🛡️ Pulse Passport <span className="font-normal text-slate-400">• Identity, profile &amp; sharing</span></h2>
        <div className="flex items-center justify-around text-center">
          <button type="button" className="min-w-0 flex-1" onClick={() => setSocial("followers")} aria-pressed={socialTab === "followers"}>
            <b className="block text-sm">{compactCount(graph.followers)}</b><span className="text-[10px] text-slate-400">Followers</span>
          </button>
          <span className="h-8 border-r border-slate-800" />
          <button type="button" className="min-w-0 flex-1" onClick={() => setSocial("following")} aria-pressed={socialTab === "following"}>
            <b className="block text-sm">{compactCount(graph.following)}</b><span className="text-[10px] text-slate-400">Following</span>
          </button>
          <span className="h-8 border-r border-slate-800" />
          {owner ? (
            <Link to="/saved" className="min-w-0 flex-1 text-xs"><Bookmark className="mx-auto mb-1 h-4 w-4" />Saved</Link>
          ) : (
            <span className="min-w-0 flex-1 text-xs text-slate-500"><Bookmark className="mx-auto mb-1 h-4 w-4" />Saved</span>
          )}
        </div>
        {socialTab && (
          <div className="mt-3 border-t border-slate-800 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold">{socialTab === "followers" ? "Followers" : "Following"}</h3>
              <button type="button" className="text-xs text-slate-400" onClick={() => setSocialTab(null)}>Close</button>
            </div>
            {owner ? (
              connections.length ? (
                <ul className="space-y-2">
                  {connections.map((person) => (
                    <li key={person.id} className="flex items-center gap-2 text-sm">
                      {person.avatar_url ? <img src={person.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <Avatar name={person.display_name ?? person.handle ?? "Member"} size={32} />}
                      <span>{person.display_name ?? "NEXORA member"}</span><span className="text-xs text-slate-400">@{person.handle}</span>
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-slate-400">No {socialTab} to show yet.</p>
            ) : <p className="text-xs text-slate-400">Follower lists are visible to the owner only.</p>}
          </div>
        )}
      </section>

      {owner && (
        <section className="mx-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3" aria-label="Creator dashboard analytics">
          <div className="mb-2 flex items-center justify-between">
            <div><h2 className="text-xs font-semibold">Creator dashboard</h2><p className="text-[10px] text-slate-400">Engagement from recorded interactions</p></div>
            <Button size="sm" variant="outline" onClick={() => setShowCreatorInsights(true)}>Insights</Button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <SummaryMetric label="Posts" value={posts.length} />
            <SummaryMetric label="Followers" value={graph.followers} />
            <SummaryMetric label="Likes" value={totalLikes} />
            <SummaryMetric label="Shares" value={totalShares} />
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">Views and comments are not tracked in the current data source.</p>
        </section>
      )}

      {privateProfile && !owner ? (
        <section className="mx-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <LockKeyhole className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-semibold">This profile is private</h2>
          <p className="mt-1 text-sm text-slate-400">Only the profile owner can view posts and saved items.</p>
        </section>
      ) : (
        <>
          {/* Instagram-style compact horizontal content tabs and dense grid */}
          <nav className="flex gap-1.5 overflow-x-auto border-b border-slate-800 bg-slate-900/40 px-4 py-2" aria-label="Profile content tabs">
            {contentTabs.map(({ id, label, Icon }) => (
              <button key={id} type="button" onClick={() => { setTab(id); setSocialTab(null); }} aria-pressed={tab === id}
                className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${tab === id ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200"}`}>
                <Icon className="h-3.5 w-3.5" />{label}
              </button>
            ))}
          </nav>

          {tab === "reposts" ? (
            <section className="p-8 text-center text-sm text-slate-400">No public reposts to show.</section>
          ) : (
            <section aria-label={`${tab} grid`} className="grid grid-cols-3 gap-0.5 bg-slate-900 p-0.5">
              {visiblePosts.map((post) => (
                <button key={post.id} type="button" onClick={() => setSelectedPost(post)} aria-label={`Open ${post.caption || "profile media"}`}
                  className="group relative aspect-[3/4] overflow-hidden bg-slate-900 text-left">
                  {post.mediaSrc ? (
                    post.media_type?.startsWith("video/") ? (
                      <video src={post.mediaSrc} className="h-full w-full object-cover transition-transform group-hover:scale-105" muted playsInline />
                    ) : <img src={post.mediaSrc} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                  ) : <div className="flex h-full items-center justify-center p-2 text-center text-xs">{post.caption || "Text post"}</div>}
                  {post.media_type?.startsWith("video/") && <Video className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow" />}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 text-[10px] text-slate-100">
                    <span><Heart className="mr-0.5 inline h-3 w-3 text-pink-400" />{compactCount(post.likes)}</span>
                    <span><MessageCircle className="mr-0.5 inline h-3 w-3 text-emerald-400" />{post.comments === null ? "—" : compactCount(post.comments)}</span>
                    <span><Share2 className="mr-0.5 inline h-3 w-3 text-amber-400" />{compactCount(post.shares)}</span>
                  </div>
                </button>
              ))}
              {!visiblePosts.length && <div className="col-span-3 p-8 text-center text-sm text-slate-400">{tab === "collabs" ? "No public collaborations yet." : "No posts to show in this tab yet."}</div>}
            </section>
          )}
        </>
      )}

      {/* Analytics drawer uses actual recorded values only; no fabricated views or comments. */}
      {selectedPost && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setSelectedPost(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="post-viewer-title" className="w-full max-w-sm space-y-4 rounded-t-2xl border border-slate-800 bg-slate-900 p-4 sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2 id="post-viewer-title" className="text-xs font-bold uppercase tracking-wider text-indigo-400">{owner ? "Content Analytics & Insights" : "Post"}</h2>
              <button type="button" onClick={() => setSelectedPost(null)} className="text-sm text-slate-400" aria-label="Close viewer">✕</button>
            </div>
            {selectedPost.mediaSrc && (selectedPost.media_type?.startsWith("video/") ? <video src={selectedPost.mediaSrc} controls playsInline className="max-h-56 w-full rounded-xl bg-black object-contain" /> : <img src={selectedPost.mediaSrc} alt="Post preview" className="max-h-56 w-full rounded-xl object-contain" />)}
            {selectedPost.caption && <p className="text-xs text-slate-300">{selectedPost.caption}</p>}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Total Views" value={selectedPost.views} />
              <Metric label="Total Likes" value={selectedPost.likes} />
              <Metric label="Comments" value={selectedPost.comments} />
              <Metric label="Shares" value={selectedPost.shares} />
            </div>
            {(selectedPost.views === null || selectedPost.comments === null) && <p className="text-center text-[10px] text-slate-400">Views and comments are not tracked in the current data source.</p>}
            <Button type="button" onClick={() => setSelectedPost(null)} className="w-full bg-indigo-600">Close Insights</Button>
          </section>
        </div>
      )}

      {showCreatorInsights && owner && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4" role="presentation" onClick={() => setShowCreatorInsights(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="creator-insights-title" className="w-full max-w-md space-y-4 rounded-t-2xl border border-slate-800 bg-slate-900 p-4 sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <div><h2 id="creator-insights-title" className="text-sm font-bold">Creator dashboard</h2><p className="text-[10px] text-slate-400">Summary from available account data</p></div>
              <button type="button" onClick={() => setShowCreatorInsights(false)} aria-label="Close dashboard" className="text-slate-400">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Metric label="Published posts" value={posts.length} />
              <Metric label="Followers" value={graph.followers} />
              <Metric label="Following" value={graph.following} />
              <Metric label="Collabs" value={totalCollabs} />
              <Metric label="Recorded likes" value={totalLikes} />
              <Metric label="Recorded shares" value={totalShares} />
              <Metric label="Views" value={null} />
              <Metric label="Comments" value={null} />
            </div>
            <p className="text-center text-[10px] text-slate-400">Analytics are limited to data currently recorded by NEXORA; unavailable values are shown as —.</p>
            <Button type="button" onClick={() => setShowCreatorInsights(false)} className="w-full bg-indigo-600">Close Dashboard</Button>
          </section>
        </div>
      )}

      <footer className="mx-4 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">☁️ Offline Relay: Queue empty</footer>
    </main>
  );
}

function SummaryMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 p-2">
      <span className="block text-[9px] text-slate-400">{label}</span>
      <span className="text-xs font-bold">{compactCount(value)}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950 p-2.5">
      <span className="block text-[10px] text-slate-400">{label}</span>
      <span className="text-sm font-bold">{value === null ? "—" : compactCount(value)}</span>
    </div>
  );
}

function compactCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

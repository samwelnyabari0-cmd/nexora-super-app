import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bookmark, Film, Grid3X3, Heart, LockKeyhole, MessageCircle, Repeat2, Share2, Users, Video } from "lucide-react";
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
  comments: number;
  shares: number;
};
type Tab = "posts" | "reels" | "videos" | "collabs" | "reposts" | "saved";
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
  const [connections, setConnections] = useState<Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>>([]);
  const owner = Boolean(user && profile && user.id === profile.id);
  const privateProfile = Boolean(profile?.settings?.privateProfile ?? profile?.settings?.private_profile);
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
      // Private profiles are never exposed to other viewers. RLS remains the source of truth;
      // this client-side check is an additional display safeguard.
      const visibleRows = (rows ?? []).filter((post: ProfilePost) =>
        found.id === user?.id || (!privateProfile && post.audience !== "private"),
      );
      const ids = visibleRows.map((post: ProfilePost) => post.id);
      let interactions: Array<{ post_id: string; kind: string }> = [];
      if (ids.length) {
        const { data: eventRows } = await (supabase as any)
          .from("post_interactions")
          .select("post_id, kind")
          .in("post_id", ids);
        interactions = eventRows ?? [];
      }
      const hydrated = await Promise.all(visibleRows.map(async (post: ProfilePost) => {
        let mediaSrc: string | undefined;
        if (post.media_url) {
          if (/^https?:\/\//i.test(post.media_url)) mediaSrc = post.media_url;
          else {
            const { data } = await supabase.storage.from("post-media").createSignedUrl(post.media_url, 900);
            mediaSrc = data?.signedUrl;
          }
        }
        const events = interactions.filter((event) => event.post_id === post.id);
        return {
          ...post,
          mediaSrc,
          likes: events.filter((event) => event.kind === "like").length,
          comments: 0,
          shares: events.filter((event) => event.kind === "share").length,
        };
      }));
      if (!cancelled) {
        setPosts(hydrated);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [handle, user?.id, privateProfile]);

  useEffect(() => {
    let cancelled = false;
    if (!profile || !socialTab || !owner) { setConnections([]); return; }
    void (async () => {
      const column = socialTab === "followers" ? "follower_id" : "following_id";
      const relationColumn = socialTab === "followers" ? "following_id" : "follower_id";
      const { data: relations } = await (supabase as any).from("follows").select(column).eq(relationColumn, profile.id).limit(100);
      const ids = (relations ?? []).map((row: Record<string, string>) => row[column]).filter(Boolean);
      if (!ids.length) { if (!cancelled) setConnections([]); return; }
      const { data } = await (supabase as any).from("profiles").select("id, display_name, handle, avatar_url").in("id", ids);
      if (!cancelled) setConnections(data ?? []);
    })();
    return () => { cancelled = true; };
  }, [profile?.id, socialTab, owner]);

  const visiblePosts = useMemo(() => {
    switch (tab) {
      case "posts": return posts.filter((post) => !post.media_type?.startsWith("video/"));
      case "reels": return posts.filter((post) => post.media_type?.startsWith("video/"));
      case "videos": return posts.filter((post) => post.media_type?.startsWith("video/"));
      case "collabs": return posts.filter((post) => post.tags?.some((tag) => tag.toLowerCase() === "collab"));
      case "reposts": return [];
      case "saved": return [];
    }
  }, [posts, tab]);

  if (loading) return <div className="mx-auto max-w-3xl p-4 text-sm text-muted-foreground" role="status">Loading Pulse Passport…</div>;
  if (error || !profile) return <div className="mx-auto max-w-3xl p-4"><Button asChild variant="ghost"><Link to="/profile"><ArrowLeft className="mr-2 h-4 w-4" /> Back to profile</Link></Button><p className="mt-6 text-sm text-muted-foreground">{error || "Profile unavailable."}</p></div>;

  const displayName = profile.display_name || profile.handle || "NEXORA member";
  const setSocial = (value: SocialTab) => setSocialTab((current) => current === value ? null : value);

  return (
    <main className="mx-auto max-w-3xl space-y-3 pb-8" aria-label={`${displayName}'s profile`}>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b bg-background/95 px-3 py-2 backdrop-blur">
        <Link to="/" className="font-display text-sm font-bold tracking-wider">NEXORA</Link>
        <span className="text-[11px] text-muted-foreground">{owner ? "Your Pulse Passport" : "Public profile"}</span>
        <Button asChild size="sm" variant="outline"><Link to="/notifications">🔔</Link></Button>
      </header>

      <section className="rounded-2xl border bg-card p-4">
        <div className="flex items-start gap-3">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover ring-2 ring-primary" /> : <Avatar name={displayName} size={56} ring />}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-lg font-bold">{displayName}</h1>
            <p className="text-xs text-muted-foreground">@{profile.handle} · {owner ? "🟢 Online" : "NEXORA"}</p>
            <p className="mt-2 text-sm">Building Nexora Super-App Ecosystem | Dev &amp; Creator</p>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {owner && <Button asChild size="sm" variant="outline"><Link to="/profile">✏️ Edit Profile</Link></Button>}
          <Button size="sm" variant="outline" onClick={() => {
            const url = window.location.href;
            if (navigator.share) void navigator.share({ title: `${displayName} on NEXORA`, url });
            else void navigator.clipboard.writeText(url);
          }}>🔗 Share Profile</Button>
          {owner && <Link to="/dashboard" className="inline-flex h-9 items-center rounded-md border px-3 text-xs font-medium">Analytics</Link>}
        </div>
      </section>

      <section className="rounded-2xl border bg-card p-3" aria-label="Pulse Passport social stats">
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold"><span aria-hidden>🛡️</span> Pulse Passport <span className="text-xs font-normal text-muted-foreground">• Identity, profile &amp; sharing</span></div>
        <div className="grid grid-cols-3 gap-2">
          <button type="button" onClick={() => setSocial("followers")} aria-pressed={socialTab === "followers"} className="rounded-xl border px-2 py-2 text-xs hover:bg-muted"><Users className="mx-auto mb-1 h-4 w-4" />Followers <b>{compactCount(graph.followers)}</b></button>
          <button type="button" onClick={() => setSocial("following")} aria-pressed={socialTab === "following"} className="rounded-xl border px-2 py-2 text-xs hover:bg-muted"><Users className="mx-auto mb-1 h-4 w-4" />Following <b>{compactCount(graph.following)}</b></button>
          <button type="button" disabled={!owner} onClick={() => setTab("saved")} className="rounded-xl border px-2 py-2 text-xs hover:bg-muted disabled:opacity-50"><Bookmark className="mx-auto mb-1 h-4 w-4" />Saved</button>
        </div>
        {socialTab && <div className="mt-3 border-t pt-3">
          <div className="mb-2 flex items-center justify-between"><h2 className="text-sm font-semibold">{socialTab === "followers" ? "Followers" : "Following"}</h2><button className="text-xs text-muted-foreground" onClick={() => setSocialTab(null)}>Close</button></div>
          {owner ? connections.length ? <ul className="space-y-2">{connections.map((person) => <li key={person.id} className="flex items-center gap-2 text-sm">{person.avatar_url ? <img src={person.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" /> : <Avatar name={person.display_name ?? person.handle ?? "Member"} size={32} />}<span>{person.display_name ?? "NEXORA member"}</span><span className="text-xs text-muted-foreground">@{person.handle}</span></li>)}</ul> : <p className="text-xs text-muted-foreground">No {socialTab} to show yet.</p> : <p className="text-xs text-muted-foreground">Sign in as the profile owner to view this list.</p>}
        </div>}
      </section>

      {privateProfile && !owner ? (
        <section className="rounded-2xl border bg-card p-8 text-center"><LockKeyhole className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 font-semibold">This profile is private</h2><p className="mt-1 text-sm text-muted-foreground">Only the profile owner can view posts and saved items.</p></section>
      ) : <>
        <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" aria-label="Profile content tabs">
          {contentTabs.map(({ id, label, Icon }) => <button key={id} type="button" onClick={() => { setTab(id); setSocialTab(null); }} aria-pressed={tab === id} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition ${tab === id ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground"}`}><Icon className="h-3.5 w-3.5" />{label}</button>)}
          {owner && <button type="button" onClick={() => { setTab("saved"); setSocialTab(null); }} aria-pressed={tab === "saved"} className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold ${tab === "saved" ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}><Bookmark className="h-3.5 w-3.5" />Saved</button>}
        </nav>

        {tab === "saved" && owner ? <section className="rounded-2xl border bg-card p-5 text-center text-sm text-muted-foreground"><Bookmark className="mx-auto mb-2 h-5 w-5" />Saved posts are private to you and are not shown on public profiles.</section> : tab === "reposts" ? <section className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">No public reposts to show.</section> : <section aria-label={`${tab} grid`} className="grid grid-cols-3 gap-1.5 sm:gap-2">
          {visiblePosts.map((post) => <button key={post.id} type="button" onClick={() => setSelectedPost(post)} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted text-left" aria-label={`Open post: ${post.caption ?? "NEXORA post"}`}>
            {post.mediaSrc ? post.media_type?.startsWith("video/") ? <video src={post.mediaSrc} className="h-full w-full object-cover" muted playsInline /> : <img src={post.mediaSrc} alt="" loading="lazy" className="h-full w-full object-cover" /> : <div className="flex h-full items-center justify-center p-2 text-center text-xs">{post.caption || "Text post"}</div>}
            {post.media_type?.startsWith("video/") && <Video className="absolute right-2 top-2 h-4 w-4 drop-shadow" />}
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-around bg-black/70 px-1 py-1.5 text-[10px] text-white"><span><Heart className="mr-1 inline h-3 w-3" />{compactCount(post.likes)}</span><span><MessageCircle className="mr-1 inline h-3 w-3" />{post.comments}</span><span><Share2 className="mr-1 inline h-3 w-3" />{compactCount(post.shares)}</span></div>
          </button>)}
          {!visiblePosts.length && <div className="col-span-3 rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">{tab === "collabs" ? "No public collaborations yet." : "No posts to show in this tab yet."}</div>}
        </section>}
      </>}

      {selectedPost && <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4" role="presentation" onClick={() => setSelectedPost(null)}>
        <section role="dialog" aria-modal="true" aria-labelledby="post-viewer-title" className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border bg-card p-4" onClick={(event) => event.stopPropagation()}>
          <div className="mb-3 flex items-center justify-between"><h2 id="post-viewer-title" className="font-semibold">Post viewer{owner ? " · Engagement analytics" : ""}</h2><button type="button" onClick={() => setSelectedPost(null)} className="rounded-full px-3 py-1 text-sm hover:bg-muted" aria-label="Close viewer">Close</button></div>
          {selectedPost.mediaSrc && (selectedPost.media_type?.startsWith("video/") ? <video src={selectedPost.mediaSrc} controls playsInline className="max-h-[55vh] w-full rounded-xl bg-black" /> : <img src={selectedPost.mediaSrc} alt="Profile post" className="max-h-[55vh] w-full rounded-xl object-contain" />)}
          <p className="mt-3 text-sm">{selectedPost.caption}</p>
          <div className="mt-3 grid grid-cols-4 gap-2 text-center text-xs"><Metric label="Likes" value={selectedPost.likes} /><Metric label="Comments" value={selectedPost.comments} /><Metric label="Shares" value={selectedPost.shares} /><Metric label="Views" value={null} /></div>
          {owner && <p className="mt-2 text-center text-[11px] text-muted-foreground">View counts are not currently recorded by the profile data source.</p>}
        </section>
      </div>}
      <footer className="rounded-xl border bg-card px-3 py-2 text-xs text-muted-foreground">☁️ Offline Relay: Queue empty</footer>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return <div className="rounded-lg border p-2"><p className="font-semibold">{value === null ? "—" : compactCount(value)}</p><p className="text-muted-foreground">{label}</p></div>;
}

function compactCount(value: number) {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

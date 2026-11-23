import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Heart,
  LockKeyhole,
  MessageCircle,
  MoreHorizontal,
  Share2,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/nexora/ui";
import { CreatorPaymentActions } from "@/components/nexora/CreatorPaymentActions";
import { PublicProfileTabs } from "@/components/nexora/PublicProfileTabs";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getFreshR2MediaPlaybackUrl } from "@/lib/r2-media-playback";
import { useSession } from "@/lib/session";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { formatRelativeTime, formatExactDateTime } from "@/lib/format-relative-time";

type ProfileRecord = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
  bio?: string | null;
  account_type?: string | null;
  profile_category?: string | null;
  bio_links?: { title: string; url: string }[] | null;
  settings?: Record<string, unknown> | null;
};
type ProfilePost = {
  id: string;
  user_id: string;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  content_type: "post" | "reel" | "video" | "collab";
  aspect_ratio: string | null;
  duration_seconds: number | null;
  audience: string | null;
  tags: string[] | null;
  created_at: string;
  media_storage_provider?: "supabase" | "r2" | null;
  media_storage_key?: string | null;
  thumbnail_storage_provider?: "supabase" | "r2" | null;
  thumbnail_storage_key?: string | null;
  mediaSrc?: string;
  mediaAsset?: "media" | "thumbnail";
  likes: number;
  comments: number | null;
  shares: number;
  views: number | null;
};
type Tab = "posts" | "reels" | "videos" | "collabs" | "reposts";
type SocialTab = "followers" | "following";
type Presentation = "social" | "media" | "studio";

export const Route = createFileRoute("/profile/$handle")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : "",
  }),
  head: () => ({
    meta: [
      { title: "Profile & Pulse Passport — NEXORA" },
      {
        name: "description",
        content: "Explore a NEXORA creator's public Pulse Passport and posts.",
      },
    ],
  }),
  component: PublicProfile,
});

function PublicProfile() {
  const { handle } = Route.useParams();
  const { post: requestedPostId } = Route.useSearch();
  const { user } = useSession();
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [posts, setPosts] = useState<ProfilePost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("posts");
  const [profileTab, setProfileTab] = useState<"grid" | "reels" | "store" | "communities">("grid");
  const [bioExpanded, setBioExpanded] = useState(false);
  const [presentation, setPresentation] = useState<Presentation>("media");
  const [socialTab, setSocialTab] = useState<SocialTab | null>(null);
  const [selectedPost, setSelectedPost] = useState<ProfilePost | null>(null);
  const [connections, setConnections] = useState<
    Array<{
      id: string;
      display_name: string | null;
      handle: string | null;
      avatar_url: string | null;
    }>
  >([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState("");
  const [connectionsReload, setConnectionsReload] = useState(0);

  const owner = Boolean(user && profile && user.id === profile.id);
  const privateProfile = Boolean(
    profile?.settings?.privateProfile === true || profile?.settings?.private_profile === true,
  );
  const graph = useSocialGraph(profile?.id);
  const attemptedMediaRefresh = useRef(new Set<string>());

  const refreshProfileMedia = async (post: ProfilePost, failedUrl: string) => {
    const asset = post.mediaAsset;
    if (!asset || !failedUrl) return;
    const provider =
      asset === "media" ? post.media_storage_provider : post.thumbnail_storage_provider;
    if (provider !== "r2") return;
    const attemptKey = `${post.id}:${asset}:${failedUrl}`;
    if (attemptedMediaRefresh.current.has(attemptKey)) return;
    attemptedMediaRefresh.current.add(attemptKey);
    const freshUrl = await getFreshR2MediaPlaybackUrl(post.id, asset);
    if (!freshUrl || freshUrl === failedUrl) return;
    const updatePost = (entry: ProfilePost) =>
      entry.id === post.id ? { ...entry, mediaSrc: freshUrl } : entry;
    setPosts((current) => current.map(updatePost));
    setSelectedPost((current) => (current?.id === post.id ? updatePost(current) : current));
  };

  useEffect(() => {
    if (!requestedPostId || loading) return;
    const match = posts.find((post) => post.id === requestedPostId);
    if (match) setSelectedPost(match);
  }, [loading, posts, requestedPostId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setProfile(null);
    setPosts([]);

    void (async () => {
      try {
        const normalizedHandle = handle.trim().replace(/^@+/, "");
        const { data: profileRows, error: profileError } = await (supabase as any).rpc(
          "get_public_profile",
          { p_handle: normalizedHandle },
        );

        if (cancelled) return;

        // Never trust a profile RPC result unless its handle matches the requested URL.
        // Some legacy RPC deployments can return a different row; resolve the exact
        // handle through the safe account-discovery RPC before rendering anything.
        const normalize = (value: unknown) =>
          String(value ?? "")
            .trim()
            .replace(/^@+/, "")
            .toLowerCase();
        let row = (Array.isArray(profileRows) ? profileRows[0] : profileRows) ?? null;
        if (!row || normalize(row.handle) !== normalize(normalizedHandle)) {
          const { data: discoveredRows, error: discoveryError } = await (supabase as any).rpc(
            "get_discoverable_profiles",
            { p_query: normalizedHandle, p_limit: 60 },
          );
          if (cancelled) return;
          if (!discoveryError && Array.isArray(discoveredRows)) {
            row =
              discoveredRows.find(
                (candidate: Record<string, unknown>) =>
                  normalize(candidate.handle) === normalize(normalizedHandle),
              ) ?? null;
          } else if (discoveryError) {
            console.error(
              "Could not resolve requested public profile:",
              profileError || discoveryError,
            );
          }
        }

        if (!row || normalize(row.handle) !== normalize(normalizedHandle)) {
          setError("This profile could not be found or is not available.");
          setLoading(false);
          return;
        }

        const found = {
          ...row,
          settings: {
            ...(row.settings ?? {}),
            privateProfile: row.private_profile,
          },
        } as ProfileRecord;
        setProfile(found);
        const isOwner = user?.id === found.id;
        const isPrivate =
          found.settings?.privateProfile === true || found.settings?.private_profile === true;

        // Avoid requesting private posts or media for non-owners. RLS remains authoritative.
        if (isPrivate && !isOwner) {
          setLoading(false);
          return;
        }

        if (tab === "reposts") {
          setPosts([]);
          setLoading(false);
          return;
        }
        const strictType =
          tab === "reels"
            ? "reel"
            : tab === "videos"
              ? "video"
              : tab === "collabs"
                ? "collab"
                : "post";
        const { data: rows, error: postsError } = await (supabase as any)
          .from("user_media_posts")
          .select(
            "id, user_id, caption, media_url, media_type, thumbnail_url, media_storage_provider, media_storage_key, thumbnail_storage_provider, thumbnail_storage_key, content_type, aspect_ratio, duration_seconds, audience, tags, created_at, like_count, comment_count, share_count, view_count",
          )
          .eq("user_id", found.id)
          .in(
            "content_type",
            tab === "posts"
              ? ["post", "reel", "video", "collab"]
              : tab === "reels"
                ? ["reel", "video"]
                : [strictType],
          )
          .order("created_at", { ascending: false })
          .limit(60);
        if (cancelled) return;
        if (postsError) {
          setError("Posts are temporarily unavailable.");
          setLoading(false);
          return;
        }

        let queryRows = rows ?? [];
        if (!isOwner)
          queryRows = queryRows.filter((post: ProfilePost) => post.audience === "public");

        const hydrated = await Promise.all(
          queryRows.map(async (post: ProfilePost) => {
            const resolveUrl = async (
              value: string | null,
              provider: "supabase" | "r2" | null | undefined,
              storageKey: string | null | undefined,
              asset: "media" | "thumbnail",
            ) => {
              if (provider === "r2") return getFreshR2MediaPlaybackUrl(post.id, asset);
              if (!value) return undefined;
              if (/^https?:\/\//i.test(value)) return value;
              const { data } = await supabase.storage
                .from("post-media")
                .createSignedUrl(storageKey || value, 900);
              return data?.signedUrl ?? undefined;
            };
            const [mediaSrc, thumbnailSrc] = await Promise.all([
              resolveUrl(
                post.media_url,
                post.media_storage_provider,
                post.media_storage_key,
                "media",
              ),
              resolveUrl(
                post.thumbnail_url,
                post.thumbnail_storage_provider,
                post.thumbnail_storage_key,
                "thumbnail",
              ),
            ]);
            return {
              ...post,
              mediaSrc: mediaSrc ?? thumbnailSrc,
              mediaAsset: mediaSrc
                ? ("media" as const)
                : thumbnailSrc
                  ? ("thumbnail" as const)
                  : undefined,
              likes: Number((post as any).like_count ?? 0),
              comments: Number((post as any).comment_count ?? 0),
              shares: Number((post as any).share_count ?? 0),
              views: Number((post as any).view_count ?? 0),
            };
          }),
        );

        if (!cancelled) {
          setPosts(hydrated);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError("The profile could not be loaded. Please try again.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [handle, user?.id, tab]);

  useEffect(() => {
    let cancelled = false;
    if (!profile || !socialTab || !owner) {
      setConnections([]);
      setConnectionsError("");
      setConnectionsLoading(false);
      return;
    }

    void (async () => {
      setConnectionsLoading(true);
      setConnectionsError("");
      setConnections([]);
      try {
        const column = socialTab === "followers" ? "follower_id" : "following_id";
        const relationColumn = socialTab === "followers" ? "following_id" : "follower_id";
        const { data: rows, error: followsError } = await (supabase as any)
          .from("follows")
          .select(column)
          .eq(relationColumn, profile.id)
          .limit(100);
        if (followsError) throw followsError;
        const ids = [
          ...new Set(
            (rows ?? []).map((row: Record<string, string>) => row[column]).filter(Boolean),
          ),
        ];
        if (!ids.length) return;

        // Reuse the approved identity RPC; direct profiles SELECT is restricted by profile RLS.
        const { data, error } = await (supabase as any).rpc("get_post_author_profiles", {
          target_user_ids: ids,
        });
        if (error) throw error;
        if (!cancelled) setConnections(data ?? []);
      } catch (reason) {
        console.error(`Could not load profile ${socialTab}:`, reason);
        if (!cancelled)
          setConnectionsError(
            reason instanceof Error ? reason.message : "Could not load accounts.",
          );
      } finally {
        if (!cancelled) setConnectionsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [profile, socialTab, owner, connectionsReload]);

  const visiblePosts = useMemo(() => {
    switch (tab) {
      case "posts":
        return posts.filter((post) =>
          ["post", "reel", "video", "collab"].includes(post.content_type),
        );
      case "reels":
        return posts.filter(
          (post) => post.content_type === "reel" || post.content_type === "video",
        );
      case "videos":
        return posts.filter((post) => post.content_type === "video");
      case "collabs":
        return posts.filter((post) => post.content_type === "collab");
      case "reposts":
        return [];
      default:
        return posts;
    }
  }, [posts, tab]);

  const totalLikes = posts.reduce((total, post) => total + post.likes, 0);
  const totalShares = posts.reduce((total, post) => total + post.shares, 0);
  const totalCollabs = posts.filter((post) => post.content_type === "collab").length;

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
          <Link to="/profile">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to profile
          </Link>
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
      if ((reason as DOMException).name !== "AbortError")
        toast.error("Unable to share this profile.");
    }
  }

  return (
    <main
      className="mx-auto min-h-screen max-w-3xl space-y-3 bg-slate-950 pb-20 text-slate-100"
      aria-label={`${displayName}'s profile`}
    >
      <header className="sticky top-0 z-30 flex h-12 items-center justify-between border-b border-slate-800 bg-slate-950/95 px-3 backdrop-blur">
        <Link
          to="/"
          aria-label="Back"
          className="grid h-9 w-9 place-items-center rounded-full hover:bg-slate-800"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="max-w-[min(65vw,18rem)] truncate text-sm font-semibold">
            @{profile.handle || handle}
          </span>
          {(profile.settings?.verified === true || profile.settings?.is_verified === true) && (
            <BadgeCheck className="h-4 w-4 shrink-0 text-sky-400" aria-label="Verified" />
          )}
          {(profile.account_type === "creator" || profile.account_type === "business") && (
            <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-300">
              {profile.account_type === "creator" ? "CREATOR" : "BUSINESS"}
            </span>
          )}
        </div>
        <details className="group relative">
          <summary
            aria-label="Profile menu"
            className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full hover:bg-slate-800"
          >
            <MoreHorizontal className="h-5 w-5" />
          </summary>
          <div className="absolute right-0 top-10 z-50 w-44 rounded-xl border border-slate-700 bg-slate-900 p-1.5 shadow-xl">
            <button
              type="button"
              onClick={() => void shareProfile()}
              className="w-full rounded-lg px-3 py-2 text-left text-xs hover:bg-slate-800"
            >
              Share profile
            </button>
            <p className="px-3 py-2 text-[10px] text-slate-500">
              Mute, block and report controls will appear here when account-safety actions are
              connected.
            </p>
          </div>
        </details>
      </header>

      <section className="space-y-3 border-b border-slate-800 px-4 pb-3 pt-4">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${displayName} avatar`}
                className="h-20 w-20 rounded-full object-cover ring-2 ring-indigo-500/70 ring-offset-2 ring-offset-slate-950"
              />
            ) : (
              <Avatar name={displayName} size={80} ring />
            )}
          </div>
          <div className="grid min-w-0 flex-1 grid-cols-3 gap-3 text-center">
            <div>
              <b className="block text-lg font-bold tabular-nums">{compactCount(posts.length)}</b>
              <span className="text-[11px] text-slate-400">Posts</span>
            </div>
            <button
              type="button"
              onClick={() => setSocial("followers")}
              aria-pressed={socialTab === "followers"}
              className="min-w-0"
            >
              <b className="block text-lg font-bold tabular-nums">
                {compactCount(graph.followers)}
              </b>
              <span className="text-[11px] text-slate-400">Followers</span>
            </button>
            <button
              type="button"
              onClick={() => setSocial("following")}
              aria-pressed={socialTab === "following"}
              className="min-w-0"
            >
              <b className="block text-lg font-bold tabular-nums">
                {compactCount(graph.following)}
              </b>
              <span className="text-[11px] text-slate-400">"Following"</span>
            </button>
          </div>
        </div>
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-sm font-bold">{displayName}</h1>
            {profile.profile_category && (
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">
                {profile.profile_category}
              </span>
            )}
          </div>
          {profile.bio && (
            <div className="text-[13px] leading-[1.35] text-slate-300">
              <p
                className={bioExpanded ? "whitespace-pre-wrap" : "line-clamp-3 whitespace-pre-wrap"}
              >
                {profile.bio}
              </p>
              {profile.bio.length > 120 && (
                <button
                  type="button"
                  onClick={() => setBioExpanded((value) => !value)}
                  className="mt-0.5 text-xs font-semibold text-slate-100"
                >
                  {bioExpanded ? "less" : "more"}
                </button>
              )}
            </div>
          )}
          {Array.isArray(profile.bio_links) &&
            profile.bio_links[0]?.url &&
            /^https?:\/\//i.test(profile.bio_links[0].url) && (
              <a
                href={profile.bio_links[0].url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-slate-800 px-2.5 py-1 text-xs text-sky-300"
              >
                <Link2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">
                  {profile.bio_links[0].title || profile.bio_links[0].url}
                </span>
              </a>
            )}
        </div>
        {!owner && (
          <div className="grid grid-cols-[1fr_1fr_40px] gap-2">
            <Button
              size="sm"
              className="h-9 bg-indigo-600 text-xs hover:bg-indigo-500"
              onClick={() => void graph.toggleFollow()}
              disabled={graph.loading || !user}
            >
              {!user ? "Sign in to follow" : graph.isFollowing ? "Following" : graph.isPending ? "Requested · Cancel request" : "Follow"}
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-9 border-slate-700 bg-slate-900 text-xs"
            >
              <Link
                to="/messages"
                search={{
                  recipient: profile.id,
                  returnTo: `/profile/${profile.handle || handle}`,
                  prompt: "Ask about rates",
                }}
              >
                <MessageCircle className="mr-1.5 h-4 w-4" />
                Message
              </Link>
            </Button>
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="h-9 w-10 border-slate-700 bg-slate-900"
              aria-label="Support creator"
              onClick={() => setProfileTab("store")}
            >
              <Heart className="h-4 w-4" />
            </Button>
          </div>
        )}
        {owner && (
          <div className="flex gap-2">
            <Button asChild size="sm" className="h-9 flex-1 bg-indigo-600">
              <Link to="/profile">Edit profile</Link>
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-9 flex-1 border-slate-700"
              onClick={() => void shareProfile()}
            >
              Share profile
            </Button>
          </div>
        )}
        {!owner && (profile.account_type === "creator" || profile.account_type === "business") && (
          <div className="flex flex-wrap gap-2" aria-label="Quick message prompts">
            {["Ask about rates", "Get more details", "Collaboration"].map((prompt) => (
              <Link
                key={prompt}
                to="/messages"
                search={{
                  recipient: profile.id,
                  returnTo: `/profile/${profile.handle || handle}`,
                  prompt,
                }}
                className="rounded-full border border-slate-700 px-3 py-1.5 text-[10px] text-slate-300 hover:border-indigo-500"
              >
                {prompt}
              </Link>
            ))}
          </div>
        )}
        <div className="flex gap-3 overflow-x-auto pb-1 pt-1" aria-label="Creator shortcuts">
          {[
            { label: "Courses", tab: "store" as const, mark: "✦" },
            { label: "Products", tab: "store" as const, mark: "▣" },
            { label: "Clubs", tab: "communities" as const, mark: "◎" },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => {
                if (item.label === "Studio") setPresentation("studio");
                else {
                  setPresentation("media");
                  setProfileTab(item.tab);
                }
              }}
              className="flex w-16 shrink-0 flex-col items-center gap-1 text-[10px] text-slate-300"
            >
              <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-700 bg-slate-900 text-lg text-indigo-300">
                {item.mark}
              </span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      </section>

      {socialTab && (
        <section className="mx-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-xs font-semibold">
              {socialTab === "followers" ? "Followers" : "Following"}
            </h2>
            <button
              type="button"
              onClick={() => setSocialTab(null)}
              className="text-xs text-slate-400"
            >
              Close
            </button>
          </div>
          {owner ? (
            connectionsLoading ? (
              <p className="text-xs text-slate-400">Loading…</p>
            ) : connectionsError ? (
              <div className="space-y-2 text-center">
                <p className="text-xs text-rose-400">Could not load accounts.</p>
                <button
                  type="button"
                  onClick={() => setConnectionsReload((value) => value + 1)}
                  className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs"
                >
                  Try again
                </button>
              </div>
            ) : connections.length ? (
              <ul className="max-h-60 space-y-2 overflow-y-auto">
                {connections.map((person) => (
                  <li key={person.id} className="flex items-center gap-2">
                    {person.handle ? (
                      <Link
                        to="/profile/$handle"
                        params={{ handle: person.handle.replace(/^@+/, "") }}
                        className="flex items-center gap-2 text-xs"
                      >
                        <Avatar name={person.display_name ?? person.handle} size={30} />
                        {person.display_name ?? person.handle}{" "}
                        <span className="text-slate-500">@{person.handle}</span>
                      </Link>
                    ) : (
                      <span className="text-xs">{person.display_name ?? "NEXORA member"}</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400">No {socialTab} accounts to show yet.</p>
            )
          ) : (
            <p className="text-xs text-slate-400">Sign in to see your connections.</p>
          )}
        </section>
      )}

      {/* Analytics dashboard is private to the owner and uses only persisted metrics. */}
      {owner && presentation === "studio" && (
        <section
          className="mx-4 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-3"
          aria-label="Creator dashboard analytics"
        >
          <div className="mb-2 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-semibold">Creator dashboard</h2>
              <p className="text-[10px] text-slate-400">Recorded engagement</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPresentation("studio")}>
              Full analytics
            </Button>
          </div>
          <div className="grid grid-cols-4 gap-1.5 text-center">
            <SummaryMetric label="Posts" value={posts.length} />
            <SummaryMetric label="Followers" value={graph.followers} />
            <SummaryMetric label="Likes" value={totalLikes} />
            <SummaryMetric label="Shares" value={totalShares} />
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-500">
            Views and comments are not tracked in the current data source.
          </p>
        </section>
      )}

      {privateProfile && !owner ? (
        <section className="mx-4 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center">
          <LockKeyhole className="mx-auto h-8 w-8 text-slate-400" />
          <h2 className="mt-3 font-semibold">This profile is private</h2>
          <p className="mt-1 text-sm text-slate-400">
            Only the profile owner can view posts and saved items.
          </p>
        </section>
      ) : (
        <>
          <PublicProfileTabs
            activeTab={profileTab}
            onChange={(nextTab) => {
              setProfileTab(nextTab);
              setTab(nextTab === "reels" ? "reels" : "posts");
            }}
          />

          {presentation === "studio" && owner && (
            <section className="mx-4 rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <h2 className="mb-3 text-xs font-semibold">Creator analytics overview</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Published posts" value={posts.length} />
                <Metric label="Followers" value={graph.followers} />
                <Metric label="Following" value={graph.following} />
                <Metric label="Collabs" value={totalCollabs} />
                <Metric label="Recorded likes" value={totalLikes} />
                <Metric label="Recorded shares" value={totalShares} />
                <Metric label="Views" value={null} />
                <Metric label="Comments" value={null} />
              </div>
              <p className="mt-3 text-center text-[10px] text-slate-400">
                Only recorded metrics are shown. Unavailable metrics are marked —.
              </p>
            </section>
          )}

          {profileTab === "store" ? (
            <section className="space-y-3 px-4 py-5">
              <div>
                <h2 className="text-sm font-semibold">Creator storefront</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Tip or subscribe to this creator through Nexora’s secure checkout.
                </p>
              </div>
              {profile.account_type === "creator" || profile.account_type === "business" ? (
                <CreatorPaymentActions creatorId={profile.id} />
              ) : (
                <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-xs text-slate-400">
                  This account has not enabled creator payments yet.
                </p>
              )}
            </section>
          ) : profileTab === "communities" ? (
            <section className="space-y-3 px-4 py-5">
              <div>
                <h2 className="text-sm font-semibold">Communities & channels</h2>
                <p className="mt-1 text-xs text-slate-400">
                  Find Nexora clubs and public groups to join.
                </p>
              </div>
              <Button asChild className="w-full bg-indigo-600">
                <Link to="/clubs">Explore Nexora communities</Link>
              </Button>
            </section>
          ) : tab === "reposts" ? (
            <section className="p-8 text-center text-sm text-slate-400">
              No public reposts to show.
            </section>
          ) : presentation === "social" ? (
            <section className="space-y-2 px-4 py-2" aria-label={`${tab} timeline`}>
              {visiblePosts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-2xl border border-slate-800 bg-slate-900 p-3"
                >
                  <p className="mb-2 text-[10px] text-slate-400">
                    @{profile.handle} · <time dateTime={post.created_at} title={formatExactDateTime(post.created_at)}>{formatRelativeTime(post.created_at)}</time>
                  </p>
                  {post.caption && (
                    <p className="mb-3 whitespace-pre-wrap text-sm">{post.caption}</p>
                  )}
                  {post.mediaSrc &&
                    (post.media_type?.startsWith("video/") ? (
                      <video
                        src={post.mediaSrc}
                        onError={(event) =>
                          void refreshProfileMedia(post, event.currentTarget.currentSrc)
                        }
                        controls
                        playsInline
                        className="max-h-96 w-full rounded-xl bg-black object-contain"
                      />
                    ) : (
                      <img
                        src={post.mediaSrc}
                        alt="Profile post"
                        onError={(event) =>
                          void refreshProfileMedia(post, event.currentTarget.currentSrc)
                        }
                        loading="lazy"
                        className="max-h-96 w-full rounded-xl object-contain"
                      />
                    ))}
                  <div className="mt-3 flex justify-between text-xs text-slate-400">
                    <span>
                      <Heart className="mr-1 inline h-3.5 w-3.5 text-pink-400" />
                      {compactCount(post.likes)}
                    </span>
                    <span>
                      <MessageCircle className="mr-1 inline h-3.5 w-3.5 text-emerald-400" />
                      {post.comments === null ? "—" : compactCount(post.comments)}
                    </span>
                    <span>
                      <Share2 className="mr-1 inline h-3.5 w-3.5 text-amber-400" />
                      {compactCount(post.shares)}
                    </span>
                  </div>
                </article>
              ))}
              {!visiblePosts.length && (
                <p className="p-8 text-center text-sm text-slate-400">No posts in this tab yet.</p>
              )}
            </section>
          ) : (
            <section
              aria-label={`${tab} media grid`}
              className="grid grid-cols-3 gap-0.5 bg-slate-900 p-0.5"
            >
              {visiblePosts.map((post) => (
                <button
                  key={post.id}
                  type="button"
                  onClick={() =>
                    post.content_type === "reel"
                      ? (window.location.href = `/reels?post=${encodeURIComponent(post.id)}`)
                      : post.content_type === "video"
                        ? (window.location.href = `/videos?post=${encodeURIComponent(post.id)}`)
                        : setSelectedPost(post)
                  }
                  aria-label={`Open ${post.caption || "profile media"}`}
                  className={`group relative overflow-hidden bg-slate-900 text-left ${presentation === "media" ? "aspect-[3/4]" : "aspect-[3/4]"}`}
                >
                  {post.mediaSrc ? (
                    post.media_type?.startsWith("video/") ? (
                      <video
                        src={post.mediaSrc}
                        onError={(event) =>
                          void refreshProfileMedia(post, event.currentTarget.currentSrc)
                        }
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                        muted
                        playsInline
                      />
                    ) : (
                      <img
                        src={post.mediaSrc}
                        alt=""
                        onError={(event) =>
                          void refreshProfileMedia(post, event.currentTarget.currentSrc)
                        }
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center p-2 text-center text-xs">
                      {post.caption || "Text post"}
                    </div>
                  )}
                  {post.media_type?.startsWith("video/") && (
                    <Video className="absolute right-2 top-2 h-4 w-4 text-white drop-shadow" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/80 via-black/30 to-transparent p-1.5 text-[10px] text-slate-100">
                    <span>
                      <Heart className="mr-0.5 inline h-3 w-3 text-pink-400" />
                      {compactCount(post.likes)}
                    </span>
                    <span>
                      <MessageCircle className="mr-0.5 inline h-3 w-3 text-emerald-400" />
                      {post.comments === null ? "—" : compactCount(post.comments)}
                    </span>
                    <span>
                      <Share2 className="mr-0.5 inline h-3 w-3 text-amber-400" />
                      {compactCount(post.shares)}
                    </span>
                  </div>
                </button>
              ))}
              {!visiblePosts.length && (
                <div className="col-span-3 p-8 text-center text-sm text-slate-400">
                  {tab === "collabs"
                    ? "No public collaborations yet."
                    : "No posts to show in this tab yet."}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {selectedPost && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/80 p-0 sm:items-center sm:p-4"
          role="presentation"
          onClick={() => setSelectedPost(null)}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="post-viewer-title"
            className="w-full max-w-sm space-y-4 rounded-t-2xl border border-slate-800 bg-slate-900 p-4 sm:rounded-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <h2
                id="post-viewer-title"
                className="text-xs font-bold uppercase tracking-wider text-indigo-400"
              >
                {owner ? "Content Analytics & Insights" : "Post"}
              </h2>
              <button
                type="button"
                onClick={() => setSelectedPost(null)}
                className="text-sm text-slate-400"
                aria-label="Close viewer"
              >
                ✕
              </button>
            </div>
            {selectedPost.mediaSrc &&
              (selectedPost.media_type?.startsWith("video/") ? (
                <video
                  src={selectedPost.mediaSrc}
                  onError={(event) =>
                    void refreshProfileMedia(selectedPost, event.currentTarget.currentSrc)
                  }
                  controls
                  playsInline
                  className="max-h-56 w-full rounded-xl bg-black object-contain"
                />
              ) : (
                <img
                  src={selectedPost.mediaSrc}
                  alt="Post preview"
                  onError={(event) =>
                    void refreshProfileMedia(selectedPost, event.currentTarget.currentSrc)
                  }
                  className="max-h-56 w-full rounded-xl object-contain"
                />
              ))}
            {selectedPost.caption && (
              <p className="text-xs text-slate-300">{selectedPost.caption}</p>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Metric label="Total Views" value={selectedPost.views} />
              <Metric label="Total Likes" value={selectedPost.likes} />
              <Metric label="Comments" value={selectedPost.comments} />
              <Metric label="Shares" value={selectedPost.shares} />
            </div>
            {(selectedPost.views === null || selectedPost.comments === null) && (
              <p className="text-center text-[10px] text-slate-400">
                Views and comments are not tracked in the current data source.
              </p>
            )}
            <Button
              type="button"
              onClick={() => setSelectedPost(null)}
              className="w-full bg-indigo-600"
            >
              Close Insights
            </Button>
          </section>
        </div>
      )}

      <footer className="mx-4 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
        ☁️ Offline Relay: Queue empty
      </footer>
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
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(
    value,
  );
}

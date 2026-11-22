import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
 import {
  ShieldCheck,
  CloudUpload,
  Users,
  UserPlus,
  Bookmark,
  Grid3X3,
  Film,
  Video,
  CheckCircle2,
  Share2,
  Pencil,
  Zap,
  Eye,
  Heart,
  MessageCircle,
  Repeat2,
  Trash2,
  X,
  Play,
  Link2,
} from "lucide-react";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { Button } from "@/components/ui/button";
import { moreLinks } from "@/components/nexora/AppShell";
import { Avatar, Chip, PageHeader, Panel } from "@/components/nexora/ui";
import { ProfileBadges } from "@/components/nexora/ProfileBadges";
import { CreatorPaymentActions } from "@/components/nexora/CreatorPaymentActions";
import { Switch } from "@/components/ui/switch";
import { PostCard } from "@/components/nexora/PostCard";
import { useStrictMediaItems, type StrictFeedType } from "@/components/nexora/StrictMediaFeed";
import type { Post } from "@/features/core/data";
export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { title: "Profile & Pulse Passport — NEXORA" },
      { name: "description", content: "Control your portable identity, interests and privacy." },
      { property: "og:title", content: "Profile — NEXORA" },
      { property: "og:description", content: "Your Pulse Passport." },
    ],
  }),
  component: Profile,
});

const allInterests = ["city", "food", "tech", "music", "dance", "travel", "nature", "creators"];
const accountTypes = [
  { value: "personal", label: "Personal / Viewer", description: "Consume, save, follow, DM, upload and tip." },
  { value: "creator", label: "Creator", description: "Creator Studio, analytics and monetization tools." },
  { value: "business", label: "Business / Merchant", description: "Ads, storefront, product tags and customer tools." },
] as const;
const profileCategories = [
  ["tech", "Tech & Gaming"], ["sports", "Sports & Health"], ["arts", "Arts & Creative"],
  ["business", "Business / Sales"], ["music", "Music & Audio"], ["education", "Education & Lifestyle"],
] as const;

function Profile() {
  const navigate = useNavigate();
  const [publicHandle, setPublicHandle] = useState<string | null>(null);
  const [checkedUrl, setCheckedUrl] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const handle = params.get("handle")?.trim();

    setPublicHandle(handle || null);
    setCheckedUrl(true);
  }, []);

  useEffect(() => {
    if (publicHandle) {
      void navigate({ to: "/profile/$handle", params: { handle: publicHandle }, replace: true });
    }
  }, [publicHandle, navigate]);

  if (!checkedUrl || publicHandle) {
    return (
      <div className="p-8 text-center">
        Loading profile...
      </div>
    );
  }

  return <OwnProfile />;
} 
  function OwnProfile() {
  const { passport, updatePassport } = useApp();
  const { user, ready } = useSession();
  const userId = user?.id;
  const { followers, following } = useSocialGraph();
  const [bio, setBio] = useState(passport.bio);
  const [bioLinks, setBioLinks] = useState<Array<{ title: string; url: string }>>([]);
  const [bioLinksOpen, setBioLinksOpen] = useState(false);
  const [privateProfile, setPrivateProfile] = useState(
    Boolean(user?.user_metadata?.private_profile),
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [socialTab, setSocialTab] = useState<"posts" | "reels" | "videos" | "collabs" | "saved" | "followers" | "following">("posts");
  const [exploreOpen, setExploreOpen] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const [accountType, setAccountType] = useState<"personal" | "creator" | "business">(user?.user_metadata?.account_type ?? "personal");
  const [profileCategory, setProfileCategory] = useState<string>(user?.user_metadata?.profile_category ?? "");
  const [connections, setConnections] = useState<
    Array<{ id: string; display_name: string | null; handle: string | null; avatar_url: string | null }>
  >([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [connectionsError, setConnectionsError] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("explore") === "1") setExploreOpen(true);
  }, []);

  useEffect(() => {
    if (!userId || (socialTab !== "followers" && socialTab !== "following")) return;
    let active = true;
    void (async () => {
      setConnectionsLoading(true);
      setConnectionsError(null);
      setConnections([]);
      try {
        // A single owner-authorized SECURITY DEFINER RPC avoids follows/profile RLS
        // hiding one side of the relationship from the signed-in account owner.
        const { data, error } = await (supabase as any).rpc(
          "get_my_profile_connections",
          { p_connection_type: socialTab },
        );
        if (error) throw error;
        if (active) setConnections(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error(`Could not load ${socialTab}:`, error);
        if (active) {
          setConnections([]);
          setConnectionsError(error instanceof Error ? error.message : "Could not load accounts. Please try again.");
        }
      } finally {
        if (active) setConnectionsLoading(false);
      }
    })();
    return () => { active = false; };
  }, [socialTab, userId]);

  useEffect(() => {
    if (ready) setPrivateProfile(Boolean(user?.user_metadata?.private_profile));
  }, [ready, user?.user_metadata?.private_profile]);

  useEffect(() => {
    if (!user) {
      setBioLinks([]);
      return;
    }
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("bio_links")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Could not load profile bio links:", error.message);
        return;
      }
      const links = Array.isArray(data?.bio_links) ? data.bio_links : [];
      setBioLinks(links.filter((link: any) =>
        link && typeof link.title === "string" && typeof link.url === "string"
      ).slice(0, 5));
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function updatePrivacy(nextPrivate: boolean) {
    setPrivateProfile(nextPrivate);
    setSavingPrivacy(true);
    const [{ error: authError }, { error: profileError }] = await Promise.all([
      supabase.auth.updateUser({ data: { private_profile: nextPrivate } }),
      user
        ? (supabase as any).from("profiles").upsert({ id: user.id, private_profile: nextPrivate })
        : Promise.resolve({ error: null }),
    ]);
    setSavingPrivacy(false);
    if (authError || profileError) setPrivateProfile(!nextPrivate);
  }

  function syncProfile(data: Record<string, string>) {
    if (!user) return;
    void Promise.all([
      supabase.auth.updateUser({ data }),
      (supabase as any).from("profiles").upsert({ id: user.id, ...data }),
    ]);
  }
  const [name, setName] = useState(passport.name);
  const [handle, setHandle] = useState(passport.handle);
useEffect(() => {
  setName(passport.name);
  setHandle(passport.handle);
  setBio(passport.bio);
}, [passport.name, passport.handle, passport.bio]);
  useEffect(() => {
    if (!user) return;
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("avatar_url")
        .eq("id", user.id)
        .maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Could not load profile photo:", error.message);
        return;
      }
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    })();
    return () => {
      active = false;
    };
  }, [user?.id]);

  async function uploadAvatar(file: File) {
    if (!user) return;
    setAvatarUploading(true);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("post-media")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      const { error: profileError } = await (supabase as any)
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      if (profileError) throw profileError;

      setAvatarUrl(data.publicUrl);
      updatePassport({ avatarUrl: data.publicUrl });
      toast.success("Profile photo saved.");
    } catch (error) {
      console.error("Profile photo upload failed:", error);
      toast.error("Could not save your profile photo. Please try again.");
    } finally {
      setAvatarUploading(false);
    }
  }

  async function shareProfile() {
    const shareData = { title: `${passport.name} on NEXORA`, text: `View @${passport.handle} on NEXORA`, url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Profile link copied");
      }
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") toast.error("Unable to share this profile");
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PageHeader
        title="Profile"
        action={
          <div className="relative">
            <Button
              type="button"
              variant={exploreOpen ? "default" : "outline"}
              size="icon"
              aria-label={exploreOpen ? "Close Explore Nexora" : "Open Explore Nexora"}
              aria-expanded={exploreOpen}
              onClick={() => setExploreOpen((open) => !open)}
              className="h-11 w-11 rounded-xl"
            >
              <Grid3X3 className="h-5 w-5" />
            </Button>
            {exploreOpen && (
              <div className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[min(90vw,380px)] overflow-y-auto rounded-2xl border bg-card p-4 shadow-2xl">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-bold">Explore Nexora</h2>
                    <p className="text-xs text-muted-foreground">Your tools and services</p>
                  </div>
                  <Button type="button" variant="ghost" size="icon" aria-label="Close Explore Nexora" onClick={() => setExploreOpen(false)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {moreLinks.map(({ to, label, icon: Icon }) => (
                    <Link
                      key={to}
                      to={to}
                      onClick={() => setExploreOpen(false)}
                      className="flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3 text-sm font-medium transition hover:border-primary/50 hover:bg-primary/5"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0">{label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        }
      />
      <Panel className="space-y-4">
        <div className="flex items-start gap-4">
          <div className="group relative shrink-0">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-[76px] w-[76px] rounded-full object-cover ring-2 ring-primary" /> : <Avatar name={passport.name} size={76} ring />}
            <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-background/80 py-1 text-center text-[10px] opacity-0 transition group-hover:opacity-100">{avatarUploading ? "Uploading" : "Change"}</span>
          </div>
          <input ref={avatarInput} type="file" accept="image/*" className="sr-only" aria-label="Profile picture" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.target.value = ""; }} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 font-display text-xl font-bold">{passport.name}<CheckCircle2 className="h-5 w-5 shrink-0 text-accent" aria-label="Verified" /></p>
            <p className="text-sm text-muted-foreground">@{passport.handle} · {profileCategories.find(([value]) => value === profileCategory)?.[1] ?? "Tech & Software Development"}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <button type="button" onClick={() => setSocialTab("followers")} className="rounded-sm text-left hover:text-foreground">
                <strong className="text-foreground">{followers.toLocaleString()}</strong> Followers
              </button>
              <button type="button" onClick={() => setSocialTab("following")} className="rounded-sm text-left hover:text-foreground">
                <strong className="text-foreground">{following.toLocaleString()}</strong> Following
              </button>
              <span className="text-brand">{(passport.reputation * 100).toLocaleString()} Nex Points</span>
            </div>
          </div>
        </div>
        <ProfileBadges
          accountType={accountType}
          industryTag={profileCategories.find(([value]) => value === profileCategory)?.[1] ?? "Tech & Gaming"}
          isVerified
        />
        {user?.id && (
          <>
            {accountType === "creator" && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-3">
                <p className="mb-2 flex items-center gap-2 text-sm font-semibold"><Zap className="h-4 w-4 text-amber-300" /> Support this creator</p>
                <CreatorPaymentActions creatorId={user.id} />
              </div>
            )}
            {accountType !== "creator" && (
              <CreatorPaymentActions creatorId={user.id} showActions={false} />
            )}
          </>
        )}
        {passport.bio && <p className="text-sm">{passport.bio}</p>}

        {bioLinks.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setBioLinksOpen((open) => !open)}
              aria-expanded={bioLinksOpen}
              aria-label={bioLinksOpen ? "Hide profile links" : "Show profile links"}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border text-primary transition hover:bg-primary/10"
            >
              <Link2 className="h-5 w-5" />
            </button>
            {bioLinksOpen && (
              <div className="mt-2 flex max-w-full flex-wrap gap-2 rounded-xl border bg-card p-3">
                {bioLinks.map((link, index) => {
                  const title = link.title.trim();
                  const rawUrl = link.url.trim();
                  let safeUrl = "";
                  try {
                    const parsedUrl = new URL(rawUrl);
                    if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
                      safeUrl = parsedUrl.href;
                    }
                  } catch {
                    safeUrl = "";
                  }
                  if (!title || !safeUrl) return null;
                  return (
                    <a
                      key={`${safeUrl}-${index}`}
                      href={safeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm text-primary hover:bg-primary/10"
                    >
                      <span aria-hidden="true">↗</span>
                      {title}
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button asChild type="button" size="sm"><Link to="/profile-settings"><Pencil className="h-4 w-4" /> Edit Profile</Link></Button>
          <Button type="button" size="sm" variant="outline" onClick={() => void shareProfile()}><Share2 className="h-4 w-4" /> Share Profile</Button>
        </div>
      </Panel>

      <Panel className="space-y-4">
        <div className="flex items-center justify-around gap-1 overflow-x-auto border-y py-1">
          {(
            [
              { value: "followers", label: "Followers", Icon: Users },
              { value: "following", label: "Following", Icon: UserPlus },
              { value: "saved", label: "Saved", Icon: Bookmark },
              { value: "posts", label: "Posts", Icon: Grid3X3 },
              { value: "reels", label: "Reels", Icon: Film },
              { value: "videos", label: "Videos", Icon: Video },
              { value: "collabs", label: "Collabs", Icon: Users },
            ] as const
          ).map(({ value, label, Icon: IconComponent }) => (
            <Button
              key={value}
              type="button"
              variant="ghost"
              size="sm"
              aria-pressed={socialTab === value}
              className={`h-14 min-w-[68px] shrink-0 flex-col gap-1 rounded-none border-b-2 px-2 ${socialTab === value ? "border-primary text-primary" : "border-transparent text-muted-foreground"}`}
              onClick={() => setSocialTab(value as typeof socialTab)}
            >
              <IconComponent className="h-5 w-5" />
              <span className="text-[10px] sm:text-xs">{label}</span>
            </Button>
          ))}
        </div>
        {(socialTab === "posts" || socialTab === "reels" || socialTab === "videos" || socialTab === "collabs" || socialTab === "saved") && (
          <ProfileMediaExperience tab={socialTab} />
        )}
        {(socialTab === "followers" || socialTab === "following") && (
          <div className="space-y-2 py-2">
            {connectionsLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground" role="status">Loading {socialTab}…</p>
            ) : connectionsError ? (
              <div className="space-y-3 py-8 text-center">
                <p className="text-sm text-destructive" role="alert">Could not load your {socialTab} accounts.</p>
                <p className="text-xs text-muted-foreground">{connectionsError}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => setSocialTab((tab) => tab)}>Try again</Button>
              </div>
            ) : connections.map((connection) => (
              <div key={connection.id} className="flex min-w-0 items-center gap-3 border-b py-3 last:border-b-0">
                {connection.handle ? (
                  <Link to="/profile/$handle" params={{ handle: connection.handle.replace(/^@+/, "") }} aria-label={`Open @${connection.handle}'s profile`} className="shrink-0">
                    {connection.avatar_url ? (
                      <img src={connection.avatar_url} alt="" className="h-11 w-11 rounded-full object-cover" />
                    ) : (
                      <Avatar name={connection.display_name ?? connection.handle} size={44} />
                    )}
                  </Link>
                ) : connection.avatar_url ? (
                  <img src={connection.avatar_url} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                ) : (
                  <Avatar name={connection.display_name ?? "NEXORA user"} size={44} />
                )}
                <div className="min-w-0 flex-1">
                  {connection.handle ? (
                    <Link to="/profile/$handle" params={{ handle: connection.handle.replace(/^@+/, "") }} className="block truncate font-semibold hover:text-primary">{connection.display_name ?? "NEXORA user"}</Link>
                  ) : (
                    <p className="truncate font-semibold">{connection.display_name ?? "NEXORA user"}</p>
                  )}
                  <p className="truncate text-sm text-muted-foreground">@{connection.handle ?? connection.id.slice(0, 8)}</p>
                </div>
                {connection.handle && (
                  <Button asChild className="shrink-0" variant="outline" size="sm">
                    <Link to="/profile/$handle" params={{ handle: connection.handle.replace(/^@+/, "") }}>View</Link>
                  </Button>
                )}
              </div>
            ))}
            {!connectionsLoading && !connections.length && <p className="py-8 text-center text-sm text-muted-foreground">No {socialTab} yet.</p>}
          </div>
        )}
      </Panel>

      <Button asChild type="button" variant="outline" className="w-full justify-start gap-3 rounded-2xl py-6">
        <Link to="/profile-settings">
          <ShieldCheck className="h-5 w-5 text-accent" />
          <span className="font-display font-semibold">Profile Settings</span>
          <span className="ml-auto text-xs text-muted-foreground">Identity, account type & privacy</span>
        </Link>
      </Button>

    </div>
  );
}

type ProfileMediaTab = "posts" | "reels" | "videos" | "collabs" | "saved";

function ProfileMediaExperience({ tab }: { tab: ProfileMediaTab }) {
  const {
    posts,
    saved,
    liked,
    reposted,
    toggleSave,
    toggleLike,
    repost,
    share,
    deletePost,
  } = useApp();

  const { user } = useSession();

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);
  const strictType: StrictFeedType = tab === "reels" ? "reel" : tab === "videos" ? "video" : tab === "collabs" ? "collab" : "post";
  const { items: strictItems, loading: strictLoading, error: strictError } = useStrictMediaItems(strictType, user?.id, tab !== "saved" && Boolean(user?.id));
  const strictIds = new Set(strictItems.map((item) => item.id));

  const activeItems = posts.filter((post) => {
    if (tab === "saved") return saved.has(post.id);
    if (post.creatorId !== "me") return false;
    return strictIds.has(post.id);
  });

  const selectedPost =
    viewerIndex === null ? null : activeItems[viewerIndex] ?? null;

  useEffect(() => {
    if (viewerIndex === null) return;

    const target = feedRef.current?.children[viewerIndex];

    if (target instanceof HTMLElement) {
      target.scrollIntoView({ behavior: "instant", block: "start" });
    }
  }, [viewerIndex]);

  async function confirmAction() {
    const target = activeItems.find((post) => post.id === confirmId);

    if (!target) {
      setConfirmId(null);
      return;
    }

    if (tab === "saved") {
      toggleSave(target.id);
      setConfirmId(null);
      return;
    }

    if (!user || target.creatorId !== "me") {
      toast.error("You can only delete your own content.");
      setConfirmId(null);
      return;
    }

    const success = await deletePost(target.id);

    if (!success) return;

    setConfirmId(null);

    if (activeItems.length <= 1) {
      setViewerIndex(null);
    } else if (viewerIndex !== null) {
      setViewerIndex(Math.min(viewerIndex, activeItems.length - 2));
    }

    toast.success("Content deleted.");
  }

  return (
    <>
      {/* Instagram-style grid grows with its content and the page scrolls naturally. */}
      <div className="relative overflow-visible rounded-2xl pr-1">
        {strictLoading ? (
          <div className="flex min-h-32 items-center justify-center py-8 text-sm text-muted-foreground" role="status">Loading {tab}…</div>
        ) : strictError ? (
          <div className="flex min-h-32 items-center justify-center py-8 text-sm text-destructive" role="alert">{strictError}</div>
        ) : activeItems.length === 0 ? (
          <div className="flex min-h-40 flex-col items-center justify-center rounded-2xl border border-dashed p-6 text-center">
            <Grid3X3 className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-semibold">
              No {tab} yet
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Your {tab} will appear here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-1 pb-5">
            {activeItems.map((post, index) => {
              const isVideo =
                post.kind === "short" ||
                post.kind === "video" ||
                post.mediaType?.startsWith("video/");

              return (
                <button
                  key={post.id}
                  type="button"
                  onClick={() => tab === "videos" ? (window.location.href = `/videos?post=${encodeURIComponent(post.id)}`) : tab === "reels" ? (window.location.href = `/reels?post=${encodeURIComponent(post.id)}`) : setViewerIndex(index)}
                  className={`group relative ${tab === "reels" ? "aspect-[9/16]" : tab === "videos" ? "aspect-video" : "aspect-square"} overflow-hidden rounded-xl border bg-muted text-left`}
                  aria-label={`Open ${post.caption || "profile content"}`}
                >
                  {post.image ? (
                    isVideo ? (
                      <video
                        src={post.image}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    ) : (
                      <img
                        src={post.image}
                        alt={post.caption || "NEXORA post"}
                        loading="lazy"
                        className="h-full w-full object-cover transition group-hover:scale-105"
                      />
                    )
                  ) : (
                    <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/40 to-muted p-2 text-center text-xs">
                      {post.caption || "NEXORA post"}
                    </div>
                  )}

                  <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-t from-black/80 via-transparent to-transparent p-2">
                    <div className="flex justify-end">
                      {isVideo && (
                        <span className="rounded-full bg-black/60 p-1 text-white">
                          <Play className="h-3 w-3" fill="white" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-1 text-[10px] font-semibold text-white">
                      <span className="flex items-center gap-1">
                        <Heart className="h-3 w-3" />
                        {post.likes}
                      </span>
                      <span className="flex items-center gap-1">
                        <MessageCircle className="h-3 w-3" />
                        {post.comments.length}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Full-screen vertical feed viewer */}
      {viewerIndex !== null && selectedPost && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-black text-white">
          <div className="absolute inset-x-0 top-0 z-30 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent p-4">
            <span className="rounded-full bg-white/10 px-3 py-2 text-xs font-semibold uppercase">
              {tab} · Swipe up or down
            </span>

            <button
              type="button"
              onClick={() => setViewerIndex(null)}
              aria-label="Close viewer"
              className="rounded-full border border-white/20 bg-black/50 p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={feedRef}
            className="h-full flex-1 snap-y snap-mandatory overflow-y-auto"
          >
            {activeItems.map((post) => {
              const isVideo =
                post.kind === "short" ||
                post.kind === "video" ||
                post.mediaType?.startsWith("video/");

              return (
                <article
                  key={post.id}
                  className="relative flex h-[100svh] min-h-[100svh] snap-start snap-always items-center justify-center bg-black"
                >
                  {post.image ? (
                    isVideo ? (
                      <video
                        src={post.image}
                        controls
                        playsInline
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <img
                        src={post.image}
                        alt={post.caption || "NEXORA content"}
                        className="h-full w-full object-contain"
                      />
                    )
                  ) : (
                    <div className="max-w-sm p-8 text-center text-lg">
                      {post.caption}
                    </div>
                  )}

                  {/* Engagement actions */}
                  <div className="absolute bottom-28 right-3 z-20 flex flex-col items-center gap-4">
                    <button
                      type="button"
                      onClick={() => toggleLike(post.id)}
                      className="flex flex-col items-center gap-1"
                      aria-label="Like post"
                    >
                      <span className="rounded-full bg-black/60 p-3">
                        <Heart
                          className={`h-5 w-5 ${
                            liked.has(post.id) ? "fill-pink-500 text-pink-500" : ""
                          }`}
                        />
                      </span>
                      <span className="text-xs">{post.likes}</span>
                    </button>

                    <div className="flex flex-col items-center gap-1">
                      <span className="rounded-full bg-black/60 p-3">
                        <MessageCircle className="h-5 w-5" />
                      </span>
                      <span className="text-xs">{post.comments.length}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => repost(post.id)}
                      className="flex flex-col items-center gap-1"
                      aria-label="Repost"
                    >
                      <span className="rounded-full bg-black/60 p-3">
                        <Repeat2
                          className={`h-5 w-5 ${
                            reposted.has(post.id) ? "text-emerald-400" : ""
                          }`}
                        />
                      </span>
                      <span className="text-xs">{post.shares}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => void share(post.id)}
                      className="rounded-full bg-black/60 p-3"
                      aria-label="Share post"
                    >
                      <Share2 className="h-5 w-5" />
                    </button>

                    <div className="flex flex-col items-center gap-1 text-xs text-slate-300">
                      <Eye className="h-5 w-5" />
                      —
                    </div>

                    {tab === "saved" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmId(post.id)}
                        className="flex flex-col items-center gap-1 text-amber-300"
                      >
                        <Bookmark className="h-5 w-5" />
                        <span className="text-[10px]">Unsave</span>
                      </button>
                    ) : user && post.creatorId === "me" ? (
                      <button
                        type="button"
                        onClick={() => setConfirmId(post.id)}
                        className="flex flex-col items-center gap-1 text-red-400"
                      >
                        <Trash2 className="h-5 w-5" />
                        <span className="text-[10px]">Delete</span>
                      </button>
                    ) : null}
                  </div>

                  {/* Caption */}
                  <div className="absolute bottom-0 left-0 right-16 z-10 space-y-2 bg-gradient-to-t from-black/95 to-transparent p-4 pb-8">
                    <p className="text-xs font-semibold">
                      @{user?.user_metadata?.handle ?? "NEXORA creator"}
                    </p>

                    <p className="whitespace-pre-wrap text-sm">
                      {post.caption}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {post.tags.map((tag) => (
                        <span key={tag} className="text-xs text-cyan-300">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <p className="text-[10px] text-slate-400">
                      {post.createdAt}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete / unsave confirmation */}
      {confirmId && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-white">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                {tab === "saved" ? "Remove saved item?" : "Delete your content?"}
              </h3>

              <button
                type="button"
                onClick={() => setConfirmId(null)}
                aria-label="Cancel"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-slate-300">
              {tab === "saved"
                ? "This removes the item from your Saved collection."
                : "This permanently deletes your own published content."}
            </p>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmId(null)}
              >
                Cancel
              </Button>

              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => void confirmAction()}
              >
                {tab === "saved" ? "Unsave" : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

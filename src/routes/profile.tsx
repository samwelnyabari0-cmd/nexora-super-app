import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, CloudUpload, Users, UserPlus, Bookmark, Grid3X3, Film, CheckCircle2, Share2, Pencil, Laptop } from "lucide-react";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { Button } from "@/components/ui/button";
import { moreLinks } from "@/components/nexora/AppShell";
import { Avatar, Chip, PageHeader, Panel } from "@/components/nexora/ui";
import { Switch } from "@/components/ui/switch";
import { PostCard } from "@/components/nexora/PostCard";

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
  const { passport, updatePassport, relay, online, syncRelay, events, posts, saved } = useApp();
  const { user, ready } = useSession();
  const { followers, following } = useSocialGraph();
  const [bio, setBio] = useState(passport.bio);
  const [privateProfile, setPrivateProfile] = useState(
    Boolean(user?.user_metadata?.private_profile),
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [socialTab, setSocialTab] = useState<"posts" | "reels" | "collabs" | "saved" | "followers" | "following">("posts");
  const [passportOpen, setPassportOpen] = useState(false);
  const [accountType, setAccountType] = useState<"personal" | "creator" | "business">(user?.user_metadata?.account_type ?? "personal");
  const [profileCategory, setProfileCategory] = useState<string>(user?.user_metadata?.profile_category ?? "");
  const [connections, setConnections] = useState<
    Array<{ id: string; display_name: string | null; handle: string | null }>
  >([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(user?.user_metadata?.avatar_url ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const avatarInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!user || (socialTab !== "followers" && socialTab !== "following")) return;
    void (async () => {
      const column = socialTab === "followers" ? "follower_id" : "following_id";
      const relationColumn = socialTab === "followers" ? "following_id" : "follower_id";
      const { data: rows } = await (supabase as any)
        .from("follows")
        .select(`${column}`)
        .eq(relationColumn, user.id);
      const ids = (rows ?? []).map((row: Record<string, string>) => row[column]).filter(Boolean);
      if (!ids.length) return setConnections([]);
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("id, display_name, handle")
        .in("id", ids);
      setConnections(profiles ?? []);
    })();
  }, [socialTab, user]);

  useEffect(() => {
    if (ready) setPrivateProfile(Boolean(user?.user_metadata?.private_profile));
  }, [ready, user?.user_metadata?.private_profile]);

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

  async function uploadAvatar(file: File) {
    if (!user) return;
    setAvatarUploading(true);
    const path = `${user.id}/avatar-${crypto.randomUUID()}.${file.name.split(".").pop() || "jpg"}`;
    const { error } = await supabase.storage.from("post-media").upload(path, file, { upsert: false, contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      setAvatarUrl(data.publicUrl);
      await Promise.all([
        supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } }),
        (supabase as any).from("profiles").upsert({ id: user.id, avatar_url: data.publicUrl }),
      ]);
    }
    setAvatarUploading(false);
  }
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <PageHeader title="Profile" />
        <div className="flex flex-wrap gap-2">
          {moreLinks.map(({ to, label, icon: Icon }) => (
            <Button key={to} asChild variant="outline" size="sm">
              <Link to={to}>
                <Icon />
                {label}
              </Link>
            </Button>
          ))}
        </div>
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
              <p className="mt-2 text-sm text-muted-foreground">{followers.toLocaleString()} Followers · {following.toLocaleString()} Following · <span className="text-brand">{(passport.reputation * 100).toLocaleString()} Nex Points</span></p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2"><Chip><ShieldCheck className="h-3.5 w-3.5" /> {accountTypes.find((type) => type.value === accountType)?.label ?? "Creator Account"}</Chip><Chip><Laptop className="h-3.5 w-3.5" /> {profileCategories.find(([value]) => value === profileCategory)?.[1] ?? "Tech & Gaming"}</Chip></div>
          <p className="text-sm">Building Nexora Super-App Ecosystem | Dev & Creator</p>
          <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => setPassportOpen(true)}><Pencil className="h-4 w-4" /> Edit Profile</Button><Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(window.location.href)}><Share2 className="h-4 w-4" /> Share Profile</Button></div>
        </Panel>
        <Button type="button" variant={passportOpen ? "default" : "outline"} className="w-full justify-start gap-3 rounded-2xl py-6" onClick={() => setPassportOpen((open) => !open)} aria-expanded={passportOpen}>
          <ShieldCheck className="h-5 w-5 text-accent" />
          <span className="font-display font-semibold">Pulse Passport</span>
          <span className="ml-auto text-xs text-muted-foreground">{passportOpen ? "Hide features" : "Identity, profile & sharing"}</span>
        </Button>
        <Panel className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { value: "followers", label: "Followers", Icon: Users },
                { value: "following", label: "Following", Icon: UserPlus },
                { value: "saved", label: "Saved", Icon: Bookmark },
                { value: "posts", label: "Posts", Icon: Grid3X3 },
                { value: "reels", label: "Reels", Icon: Film },
                { value: "collabs", label: "Collabs", Icon: Users },
              ] as const
            ).map(({ value, label, Icon: IconComponent }) => (
              <Button
                key={value}
                variant={socialTab === value ? "default" : "outline"}
                size="sm"
                onClick={() => setSocialTab(value as typeof socialTab)}
              >
                <IconComponent className="h-4 w-4" /> {label}
              </Button>
            ))}
          </div>
          {(socialTab === "posts" || socialTab === "reels" || socialTab === "collabs") && (
            <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
              {posts.filter((post) => post.creatorId === "me" && (socialTab === "posts" || (socialTab === "reels" && post.kind === "short") || (socialTab === "collabs" && post.kind === "collab"))).map((post) => <ProfileMediaTile key={post.id} post={post} />)}
              {!posts.some((post) => post.creatorId === "me" && (socialTab === "posts" || (socialTab === "reels" && post.kind === "short") || (socialTab === "collabs" && post.kind === "collab"))) && <p className="col-span-3 py-8 text-center text-sm text-muted-foreground">Your {socialTab} will appear here.</p>}
            </div>
          )}
          {socialTab === "saved" && (
            <div className="space-y-4">
              {posts
                .filter((post) => saved.has(post.id))
                .map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              {!posts.some((post) => saved.has(post.id)) && (
                <p className="text-sm text-muted-foreground">Saved posts are private to you.</p>
              )}
            </div>
          )}
          {(socialTab === "followers" || socialTab === "following") && (
            <div className="space-y-2">
              {connections.map((connection) => (
                <div key={connection.id} className="flex items-center gap-3 rounded-xl border p-3">
                  <Avatar
                    name={connection.display_name ?? connection.handle ?? "NEXORA user"}
                    size={40}
                  />
                  <div className="min-w-0">
                    <p className="font-semibold">{connection.display_name ?? "NEXORA user"}</p>
                    <p className="text-sm text-muted-foreground">
                      @{connection.handle ?? connection.id.slice(0, 8)}
                    </p>
                  </div>
                  <Button className="ml-auto" variant="outline" size="sm">
                    View
                  </Button>
                </div>
              ))}
              {!connections.length && (
                <p className="text-sm text-muted-foreground">No {socialTab} yet.</p>
              )}
            </div>
          )}
        </Panel>
        {passportOpen && <Panel className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border bg-background/50 p-3">
            <button type="button" className="group relative shrink-0" onClick={() => avatarInput.current?.click()} aria-label="Change profile picture">
              {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-14 w-14 rounded-full object-cover ring-2 ring-primary" /> : <Avatar name={passport.name} size={56} ring />}
              <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-background/80 py-1 text-center text-[9px] opacity-0 transition group-hover:opacity-100">{avatarUploading ? "Uploading" : "Change"}</span>
            </button>
            <div><p className="font-semibold">Profile photo</p><p className="text-xs text-muted-foreground">Upload or change your Pulse Passport photo.</p></div>
          </div>
          <p className="flex items-center gap-2 font-display font-semibold">
            <ShieldCheck className="h-5 w-5 text-accent" /> Pulse Passport
          </p>
          <p className="text-sm text-muted-foreground">
            Verified account identity · profile, interests, and sharing preferences are stored
            securely.
          </p>
          <div className="flex items-center gap-3">
            <span className="font-display text-3xl font-bold text-brand">
              {passport.reputation}
            </span>
            <span className="text-sm text-muted-foreground">reputation score</span>
          </div>
          <div className="space-y-3 rounded-2xl border bg-background/50 p-3">
            <div><p className="font-semibold">Account type</p><p className="text-xs text-muted-foreground">Choose the tools and profile experience that fit you.</p></div>
            <div className="grid gap-2 sm:grid-cols-3">
              {accountTypes.map((type) => <button key={type.value} type="button" onClick={() => { setAccountType(type.value); syncProfile({ account_type: type.value }); }} className={`rounded-xl border p-3 text-left transition ${accountType === type.value ? "border-primary bg-primary/10" : "hover:bg-muted"}`}><p className="text-sm font-semibold">{type.label}</p><p className="mt-1 text-xs text-muted-foreground">{type.description}</p></button>)}
            </div>
            {(accountType === "creator" || accountType === "business") && <div><p className="mb-2 text-sm font-semibold">Profile category</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{profileCategories.map(([value, label]) => <button key={value} type="button" onClick={() => { setProfileCategory(value); syncProfile({ profile_category: value }); }} className={`rounded-lg border px-2 py-2 text-xs ${profileCategory === value ? "border-accent bg-accent/10 text-accent" : "hover:bg-muted"}`}>{label}</button>)}</div></div>}
          </div>
          <label className="block space-y-2 text-sm font-semibold">
            Display name
            <input
              aria-label="Display name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => {
                if (name.trim()) {
                  updatePassport({ name: name.trim() });
                  syncProfile({ display_name: name.trim() });
                }
              }}
              className="w-full rounded-xl border bg-background px-3 py-2"
            />
          </label>
          <label className="block space-y-2 text-sm font-semibold">
            Handle
            <input
              aria-label="Profile handle"
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9._]/g, ""))}
              onBlur={() => {
                if (handle) {
                  updatePassport({ handle });
                  syncProfile({ handle });
                }
              }}
              className="w-full rounded-xl border bg-background px-3 py-2"
            />
          </label>
          <label htmlFor="bio" className="text-sm font-semibold">
            Bio
          </label>
          <input
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            onBlur={() => {
              updatePassport({ bio });
              syncProfile({ bio });
            }}
            className="w-full rounded-xl border bg-background px-3 py-2"
          />
          <p className="text-sm font-semibold">Interests</p>
          <div className="flex flex-wrap gap-2">
            {allInterests.map((i) => (
              <Chip
                key={i}
                active={passport.interests.includes(i)}
                onClick={() => {
                  const interests = passport.interests.includes(i)
                    ? passport.interests.filter((x) => x !== i)
                    : [...passport.interests, i];
                  updatePassport({ interests });
                  syncProfile({ interests: JSON.stringify(interests) });
                }}
              >
                {i}
              </Chip>
            ))}
          </div>
          <div className="rounded-2xl border p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Profile visibility</p>
                <p className="text-sm text-muted-foreground">
                  {privateProfile
                    ? "Only approved followers can see your profile and posts."
                    : "Anyone can discover your profile and public posts."}
                </p>
              </div>
              <Switch
                checked={!privateProfile}
                disabled={!user || savingPrivacy}
                onCheckedChange={(isPublic) => void updatePrivacy(!isPublic)}
                aria-label="Make profile public"
              />
            </div>
            {!user && (
              <Link
                to="/auth"
                className="mt-2 inline-block text-sm font-semibold text-accent underline"
              >
                Sign in to change visibility
              </Link>
            )}
          </div>
          <p className="pt-2 text-sm font-semibold">Sharing permissions</p>
          {(Object.keys(passport.share) as (keyof typeof passport.share)[]).map((k) => (
            <label
              key={k}
              className="flex items-center justify-between rounded-xl border px-3 py-2 text-sm capitalize"
            >
              Share {k}
              <Switch
                checked={passport.share[k]}
                onCheckedChange={(v) => updatePassport({ share: { ...passport.share, [k]: v } })}
              />
            </label>
          ))}
        </Panel>}
      </div>
      <div className="space-y-4">
        <Panel className="space-y-2">
          <p className="flex items-center gap-2 font-display font-semibold">
            <CloudUpload className="h-5 w-5 text-accent" /> Offline Relay
          </p>
          <p className="text-sm text-muted-foreground">
            Toggle "Online" in the top bar to simulate losing connection. Posts and messages queue
            here.
          </p>
          {relay.length === 0 ? (
            <p className="text-sm">Queue empty.</p>
          ) : (
            <ul className="space-y-1">
              {relay.map((r) => (
                <li key={r.id} className="rounded-lg bg-muted px-3 py-2 text-sm">
                  <b className="uppercase text-accent">{r.kind}</b> {r.label}
                </li>
              ))}
            </ul>
          )}
          <Button disabled={!online || !relay.length} onClick={syncRelay} className="bg-brand">
            Sync locally
          </Button>
        </Panel>
        <Panel>
          <p className="mb-2 font-display font-semibold">Activity events</p>
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">Like, comment or message to see events.</p>
          ) : (
            <ul className="space-y-1 font-mono text-xs">
              {events.slice(0, 8).map((e) => (
                <li key={e.id}>
                  {e.type} · {e.detail}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProfileMediaTile({ post }: { post: Post }) {
  const isVideo = post.kind === "short" || post.mediaType?.startsWith("video/");
  return (
    <article className="group relative aspect-square overflow-hidden bg-muted">
      {post.image ? <img src={post.image} alt={post.caption || "NEXORA post"} className="h-full w-full object-cover transition duration-300 group-hover:scale-105" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/50 via-accent/30 to-muted p-3 text-center text-xs font-semibold">{post.caption || "NEXORA post"}</div>}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-80" />
      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between text-[11px] font-semibold text-white">
        <span className="truncate">{post.caption || "NEXORA"}</span>
        {isVideo && <span className="rounded-md bg-white/90 px-1.5 py-0.5 text-black">Reel</span>}
      </div>
    </article>
  );
}

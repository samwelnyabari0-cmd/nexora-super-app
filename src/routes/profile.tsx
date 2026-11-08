import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, CloudUpload, Users, UserPlus, Bookmark, Grid3X3 } from "lucide-react";
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

function Profile() {
  const { passport, updatePassport, relay, online, syncRelay, events, posts, saved } = useApp();
  const { user, ready } = useSession();
  const { followers, following } = useSocialGraph();
  const [bio, setBio] = useState(passport.bio);
  const [privateProfile, setPrivateProfile] = useState(
    Boolean(user?.user_metadata?.private_profile),
  );
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [socialTab, setSocialTab] = useState<"posts" | "saved" | "followers" | "following">(
    "posts",
  );
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
        <Panel className="flex items-center gap-4">
          <button type="button" className="group relative shrink-0" onClick={() => avatarInput.current?.click()} aria-label="Upload profile picture">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-[72px] w-[72px] rounded-full object-cover ring-2 ring-primary" /> : <Avatar name={passport.name} size={72} ring />}
            <span className="absolute inset-x-0 bottom-0 rounded-b-full bg-background/80 py-1 text-center text-[10px] opacity-0 transition group-hover:opacity-100">{avatarUploading ? "Uploading" : "Change"}</span>
          </button>
          <input ref={avatarInput} type="file" accept="image/*" className="sr-only" aria-label="Profile picture" onChange={(event) => { const file = event.target.files?.[0]; if (file) void uploadAvatar(file); event.target.value = ""; }} />
          <div>
            <p className="font-display text-xl font-bold">{passport.name}</p>
            <p className="text-sm text-muted-foreground">
              @{passport.handle} · {privateProfile ? "Private" : "Public"}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-3 text-sm">
              <span>{posts.filter((p) => p.creatorId === "me").length} posts</span>
              <span>{followers} followers</span>
              <span>{following} following</span>
              <span>{saved.size} saved</span>
            </p>
          </div>
        </Panel>
        <Panel className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(
              [
                { value: "posts", label: "Posts", Icon: Grid3X3 },
                { value: "saved", label: "Saved", Icon: Bookmark },
                { value: "followers", label: "Followers", Icon: Users },
                { value: "following", label: "Following", Icon: UserPlus },
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
          {socialTab === "posts" && (
            <div className="space-y-4">
              {posts
                .filter((post) => post.creatorId === "me")
                .map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              {!posts.some((post) => post.creatorId === "me") && (
                <p className="text-sm text-muted-foreground">Your posts will appear here.</p>
              )}
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
        <Panel className="space-y-3">
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
        </Panel>
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

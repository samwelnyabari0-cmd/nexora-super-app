import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, CloudUpload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { Button } from "@/components/ui/button";
import { moreLinks } from "@/components/nexora/AppShell";
import { Avatar, Chip, PageHeader, Panel } from "@/components/nexora/ui";
import { Switch } from "@/components/ui/switch";

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
  const [bio, setBio] = useState(passport.bio);
  const [privateProfile, setPrivateProfile] = useState(Boolean(user?.user_metadata?.private_profile));
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  useEffect(() => {
    if (ready) setPrivateProfile(Boolean(user?.user_metadata?.private_profile));
  }, [ready, user?.user_metadata?.private_profile]);

  async function updatePrivacy(nextPrivate: boolean) {
    setPrivateProfile(nextPrivate);
    setSavingPrivacy(true);
    const [{ error: authError }, { error: profileError }] = await Promise.all([
      supabase.auth.updateUser({ data: { private_profile: nextPrivate } }),
      user ? (supabase as any).from("profiles").upsert({ id: user.id, private_profile: nextPrivate }) : Promise.resolve({ error: null }),
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
          <Avatar name={passport.name} size={72} ring />
          <div>
            <p className="font-display text-xl font-bold">{passport.name}</p>
            <p className="text-sm text-muted-foreground">
              @{passport.handle} · {privateProfile ? "Private" : "Public"}
            </p>
            <p className="mt-1 text-sm">
              {posts.filter((p) => p.creatorId === "me").length} posts · {saved.size} saved
            </p>
          </div>
        </Panel>
        <Panel className="space-y-3">
          <p className="flex items-center gap-2 font-display font-semibold">
            <ShieldCheck className="h-5 w-5 text-accent" /> Pulse Passport
          </p>
          <p className="text-sm text-muted-foreground">
            Demo identity · sharing preferences are local, not enforced across external services.
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
                onClick={() =>
                  updatePassport({
                    interests: passport.interests.includes(i)
                      ? passport.interests.filter((x) => x !== i)
                      : [...passport.interests, i],
                  })
                }
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
                  {privateProfile ? "Only approved followers can see your profile and posts." : "Anyone can discover your profile and public posts."}
                </p>
              </div>
              <Switch checked={!privateProfile} disabled={!user || savingPrivacy} onCheckedChange={(isPublic) => void updatePrivacy(!isPublic)} aria-label="Make profile public" />
            </div>
            {!user && <Link to="/auth" className="mt-2 inline-block text-sm font-semibold text-accent underline">Sign in to change visibility</Link>}
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

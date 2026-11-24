import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowLeft, ArrowUp, Camera, ShieldCheck, UserRound, BriefcaseBusiness, Sparkles, Link2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Panel, PageHeader, Avatar, Chip } from "@/components/nexora/ui";
import { ProfileBadges } from "@/components/nexora/ProfileBadges";
import { CreatorStudio } from "@/components/nexora/CreatorStudio";
import { BusinessSuite } from "@/components/nexora/BusinessSuite";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { normalizeEducationSkills } from "@/features/academy/educatorDirectory";

export const Route = createFileRoute("/profile-settings")({
  head: () => ({ meta: [{ title: "Profile settings — NEXORA" }] }),
  component: ProfileSettings,
});

type BioLink = { title: string; url: string };
type FollowRequest = { id: string; requester_id: string; display_name: string | null; handle: string | null; avatar_url: string | null; created_at: string };

const interests = ["city", "food", "tech", "music", "dance", "travel", "nature", "creators"];
const suggestedEducationSkills = ["React", "WebGL", "UI/UX", "Video Editing", "JavaScript", "Python", "Graphic Design", "Mathematics", "Science", "AI Tools", "Data Analysis", "Writing", "Photography", "Music", "Language Learning"];
const categories = [
  ["tech", "Tech & Gaming"], ["sports", "Sports & Health"], ["arts", "Arts & Creative"],
  ["business", "Business / Sales"], ["music", "Music & Audio"], ["education", "Education & Lifestyle"],
] as const;

function ProfileSettings() {
  const { user } = useSession();
  const { passport, updatePassport } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [accountType, setAccountType] = useState<"personal" | "creator" | "business">("personal");
  const [category, setCategory] = useState("");
  const [privateProfile, setPrivateProfile] = useState(false);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [educationSkills, setEducationSkills] = useState<string[]>([]);
  const [newEducationSkill, setNewEducationSkill] = useState("");
  const [bioLinks, setBioLinks] = useState<BioLink[]>([]);
  const [followRequests, setFollowRequests] = useState<FollowRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [bioLinksOpen, setBioLinksOpen] = useState(false);
  const [share, setShare] = useState<typeof passport.share>(passport.share);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  async function deleteAccount() {
    if (deleteConfirmation !== "DELETE MY ACCOUNT") {
      toast.error("Type DELETE MY ACCOUNT exactly to confirm.");
      return;
    }
    setDeletingAccount(true);
    try {
      const { error } = await supabase.functions.invoke("delete-account", {
        body: { confirmation: deleteConfirmation },
      });
      if (error) {
        let message = error.message || "Could not delete this account.";
        try {
          const detail = await error.context?.json();
          if (typeof detail?.error === "string") message = detail.error;
        } catch {
          // Keep the function's standard error message if no response body is available.
        }
        throw new Error(message);
      }
      await supabase.auth.signOut({ scope: "local" });
      window.location.assign("/auth");
    } catch (error) {
      console.error("Permanent account deletion failed:", error);
      toast.error(error instanceof Error ? error.message : "Could not delete this account.");
      setDeletingAccount(false);
    }
  }

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any).from("profiles")
        .select("display_name, handle, bio, avatar_url, account_type, profile_category, private_profile, discoverable, education_skills, interests, bio_links")
        .eq("id", user.id).maybeSingle();
      if (!active) return;
      if (error) {
        console.error("Profile settings load failed:", error);
        toast.error("Could not load profile settings.");
      } else {
        const metadata = user.user_metadata ?? {};
        setName(data?.display_name ?? metadata.display_name ?? metadata.full_name ?? passport.name ?? "");
        setHandle(data?.handle ?? metadata.handle ?? passport.handle ?? "");
        setBio(data?.bio ?? metadata.bio ?? passport.bio ?? "");
        setAvatarUrl(data?.avatar_url ?? null);
        setAccountType(data?.account_type ?? metadata.account_type ?? "personal");
        setCategory(data?.profile_category ?? metadata.profile_category ?? "");
        setPrivateProfile(Boolean(data?.private_profile ?? metadata.private_profile));
        setEducationSkills(normalizeEducationSkills(data?.education_skills));
        setSelectedInterests(Array.isArray(data?.interests) ? data.interests : passport.interests ?? []);
        setBioLinks(Array.isArray(data?.bio_links) ? data.bio_links.filter((item: any) => item && typeof item.title === "string" && typeof item.url === "string").slice(0, 5) : []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) { setFollowRequests([]); return; }
    let active = true;
    setRequestsLoading(true);
    void (supabase as any).rpc("get_my_follow_requests").then(({ data, error }: { data: FollowRequest[] | null; error: any }) => {
      if (!active) return;
      if (error) {
        console.error("Follow requests could not be loaded:", error);
        setFollowRequests([]);
      } else setFollowRequests(data ?? []);
      setRequestsLoading(false);
    });
    return () => { active = false; };
  }, [user?.id]);

  async function decideFollowRequest(requestId: string, decision: "approve" | "decline") {
    const { error } = await (supabase as any).rpc(
      decision === "approve" ? "approve_follow_request" : "decline_follow_request",
      { p_request_id: requestId },
    );
    if (error) {
      toast.error(decision === "approve" ? "Could not approve this request." : "Could not decline this request.");
      return;
    }
    setFollowRequests((current) => current.filter((request) => request.id !== requestId));
    toast.success(decision === "approve" ? "Follow request approved." : "Follow request declined.");
  }

  async function save() {
    if (!user) { toast.error("Sign in to update your profile."); return; }
    setSaving(true);
    const cleanHandle = handle.trim().replace(/^@/, "");
    const cleanBioLinks = bioLinks.map(link => ({ title: link.title.trim(), url: link.url.trim() })).filter(link => link.title || link.url);
    const cleanEducationSkills = normalizeEducationSkills(educationSkills);
    for (const link of cleanBioLinks) {
      try {
        const parsed = new URL(link.url);
        if (!link.title || !["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        setSaving(false);
        toast.error("Each bio link needs a title and a valid http:// or https:// URL.");
        return;
      }
    }
    if (cleanBioLinks.length > 5) {
      setSaving(false);
      toast.error("You can add up to 5 bio links.");
      return;
    }
    const { error } = await (supabase as any).from("profiles").upsert({
      id: user.id, display_name: name.trim(), handle: cleanHandle, bio: bio.trim(),
      account_type: accountType, profile_category: category || null,
      private_profile: privateProfile, discoverable: true, education_skills: cleanEducationSkills, interests: selectedInterests, bio_links: cleanBioLinks,
    });
    if (!error) {
      const { error: authError } = await supabase.auth.updateUser({ data: {
        display_name: name.trim(), handle: cleanHandle, bio: bio.trim(),
        account_type: accountType, profile_category: category || null, private_profile: privateProfile,
        discoverable: true, education_skills: cleanEducationSkills,
      } });
      if (authError) console.error("Auth metadata sync warning:", authError);
      updatePassport({ name: name.trim(), handle: cleanHandle, bio: bio.trim(), interests: selectedInterests, share });
      toast.success("Profile settings saved.");
    } else {
      console.error("Profile settings save failed:", error);
      toast.error(error.message || "Could not save profile settings.");
    }
    setSaving(false);
  }

  async function uploadPhoto(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/avatar-${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("post-media")
        .upload(path, file, { upsert: false, contentType: file.type || "image/jpeg" });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("post-media").getPublicUrl(path);
      const { error } = await (supabase as any).from("profiles").update({ avatar_url: data.publicUrl }).eq("id", user.id);
      if (error) throw error;
      setAvatarUrl(data.publicUrl);
      updatePassport({ avatarUrl: data.publicUrl });
      toast.success("Profile photo updated.");
    } catch (error) {
      console.error("Profile photo update failed:", error);
      toast.error("Could not update profile photo.");
    } finally { setUploading(false); }
  }

  if (!user) return <div className="space-y-4"><PageHeader title="Profile settings" /><Panel><p className="text-sm text-muted-foreground">Sign in to manage your profile.</p><Button asChild className="mt-3"><Link to="/auth">Sign in</Link></Button></Panel></div>;
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading profile settings…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <Button asChild variant="outline" size="icon"><Link to="/profile" aria-label="Back to profile"><ArrowLeft className="h-4 w-4" /></Link></Button>
        <PageHeader title="Profile settings" subtitle="Manage your public identity and profile experience." />
      </div>

      <Panel className="space-y-4">
        <h2 className="flex items-center gap-2 font-semibold"><UserRound className="h-5 w-5" /> Personal information</h2>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => fileRef.current?.click()} className="relative" aria-label="Change profile photo">
            {avatarUrl ? <img src={avatarUrl} alt="Profile" className="h-20 w-20 rounded-full object-cover ring-2 ring-primary" /> : <Avatar name={name || handle || "NEXORA"} size={80} ring />}
            <span className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground"><Camera className="h-4 w-4" /></span>
          </button>
          <div><p className="font-medium">Profile photo</p><p className="text-xs text-muted-foreground">{uploading ? "Uploading…" : "Tap the photo to change it."}</p></div>
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={e => { const f=e.target.files?.[0]; if(f) void uploadPhoto(f); e.currentTarget.value=""; }} />
        </div>
        <label className="block space-y-1 text-sm font-medium">Display name<input value={name} onChange={e=>setName(e.target.value)} maxLength={60} className="w-full rounded-xl border bg-background px-3 py-2 font-normal" /></label>
        <label className="block space-y-1 text-sm font-medium">Handle<input value={handle} onChange={e=>setHandle(e.target.value.replace(/[^a-zA-Z0-9._@]/g,""))} maxLength={30} className="w-full rounded-xl border bg-background px-3 py-2 font-normal" /></label>
        <label className="block space-y-1 text-sm font-medium">Bio<textarea value={bio} onChange={e=>setBio(e.target.value)} maxLength={160} rows={3} className="w-full rounded-xl border bg-background px-3 py-2 font-normal" /></label>
      </Panel>

      <Panel className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold">Bio links</h2>
            <p className="text-xs text-muted-foreground">Manage up to 5 website or social links.</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label={bioLinksOpen ? "Hide bio links" : "Show bio links"}
            aria-expanded={bioLinksOpen}
            onClick={() => setBioLinksOpen(open => !open)}
          >
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
        {bioLinksOpen && <>
        <p className="text-xs text-muted-foreground">Add links to your website, social pages, portfolio or store. They will be saved with your profile.</p>
        {bioLinks.map((link, index) => (
          <div key={index} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium">Link {index + 1}</p>
              <Button type="button" variant="ghost" size="icon" aria-label={`Remove link ${index + 1}`} onClick={() => setBioLinks(current => current.filter((_, i) => i !== index))}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
            <input value={link.title} onChange={e => setBioLinks(current => current.map((item, i) => i === index ? { ...item, title: e.target.value } : item))} maxLength={40} placeholder="Link title (e.g. My website)" className="w-full rounded-xl border bg-background px-3 py-2 text-sm" />
            <input type="url" value={link.url} onChange={e => setBioLinks(current => current.map((item, i) => i === index ? { ...item, url: e.target.value } : item))} placeholder="https://example.com" className="w-full rounded-xl border bg-background px-3 py-2 text-sm" />
          </div>
        ))}
        {bioLinks.length < 5 && (
          <Button type="button" variant="outline" className="w-full" onClick={() => setBioLinks(current => [...current, { title: "", url: "" }])}>
            <Plus className="mr-2 h-4 w-4" /> Add bio link
          </Button>
        )}
        </>}
      </Panel>

      <Panel className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><BriefcaseBusiness className="h-5 w-5" /> Account type</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {([{value:"personal",label:"Personal",desc:"Social and discovery features."},{value:"creator",label:"Creator",desc:"Creator Studio and monetization."},{value:"business",label:"Business",desc:"Business tools and storefront."}] as const).map(t=><button key={t.value} type="button" onClick={()=>setAccountType(t.value)} className={`rounded-xl border p-3 text-left ${accountType===t.value?"border-primary bg-primary/10":"hover:bg-muted"}`}><p className="font-semibold">{t.label}</p><p className="mt-1 text-xs text-muted-foreground">{t.desc}</p></button>)}
        </div>
        {(accountType==="creator" || accountType==="business") && <div className="space-y-2"><p className="text-sm font-medium">Profile category</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{categories.map(([value,label])=><button key={value} type="button" onClick={()=>{setCategory(value);}} className={`rounded-lg border p-2 text-xs ${category===value?"border-primary bg-primary/10":"hover:bg-muted"}`}>{label}</button>)}</div></div>}
        <ProfileBadges accountType={accountType} industryTag={categories.find(([v])=>v===category)?.[1] ?? "Tech & Gaming"} isVerified />
      </Panel>

      {category === "education" && (
        <Panel className="space-y-3">
          <div>
            <h2 className="font-semibold">Education profile</h2>
            <p className="text-xs text-muted-foreground">Add the subjects and skills you teach. Your public posts, Reels and videos can appear automatically in Academy Hub. Private profiles remain limited to approved followers.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedEducationSkills.map(skill => (
              <Chip key={skill} active={educationSkills.some(item => item.toLowerCase() === skill.toLowerCase())}
                onClick={() => setEducationSkills(current => current.some(item => item.toLowerCase() === skill.toLowerCase())
                  ? current.filter(item => item.toLowerCase() !== skill.toLowerCase())
                  : current.length < 20 ? [...current, skill] : current)}>
                {skill}
              </Chip>
            ))}
          </div>
          <div className="flex gap-2">
            <input value={newEducationSkill} onChange={event => setNewEducationSkill(event.target.value)}
              maxLength={32} placeholder="Add another skill" className="min-w-0 flex-1 rounded-xl border bg-background px-3 py-2 text-sm" />
            <Button type="button" variant="outline" disabled={!newEducationSkill.trim() || educationSkills.length >= 20}
              onClick={() => {
                const skill = newEducationSkill.trim().replace(/\s+/g, " ");
                if (!skill) return;
                if (educationSkills.some(item => item.toLowerCase() === skill.toLowerCase())) {
                  toast.error("That skill is already added.");
                  return;
                }
                setEducationSkills(current => [...current, skill].slice(0, 20));
                setNewEducationSkill("");
              }}>
              Add
            </Button>
          </div>
          {educationSkills.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Your skills · drag order using the arrows</p>
              {educationSkills.map((skill, index) => (
                <div key={skill} className="flex items-center gap-2 rounded-xl border px-3 py-2">
                  <span className="min-w-0 flex-1 text-sm">{skill}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={"Move " + skill + " up"} disabled={index === 0}
                    onClick={() => setEducationSkills(current => { const next = [...current]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; return next; })}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={"Move " + skill + " down"} disabled={index === educationSkills.length - 1}
                    onClick={() => setEducationSkills(current => { const next = [...current]; [next[index + 1], next[index]] = [next[index], next[index + 1]]; return next; })}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8" aria-label={"Remove " + skill}
                    onClick={() => setEducationSkills(current => current.filter(item => item !== skill))}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      )}

      <Panel className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" /> Privacy</h2>
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Public profile</p><p className="text-xs text-muted-foreground">{privateProfile?"Only approved followers can see your profile and posts.":"Anyone can discover your profile and public posts."}</p></div><Switch checked={!privateProfile} onCheckedChange={v=>setPrivateProfile(!v)} /></div>
      </Panel>

      {privateProfile && (
        <Panel className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold">Follow requests</h2>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{followRequests.length}</span>
          </div>
          {requestsLoading ? <p className="text-sm text-muted-foreground">Loading requests…</p> : followRequests.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending follow requests.</p>
          ) : followRequests.map((request) => (
            <div key={request.id} className="flex items-center gap-3 rounded-xl border p-3">
              {request.avatar_url ? <img src={request.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" /> : <Avatar name={request.display_name || request.handle || "NEXORA"} size={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{request.display_name || request.handle || "NEXORA member"}</p>
                <p className="truncate text-xs text-muted-foreground">@{request.handle || "member"}</p>
              </div>
              <Button size="sm" onClick={() => void decideFollowRequest(request.id, "approve")}>Approve</Button>
              <Button size="sm" variant="outline" onClick={() => void decideFollowRequest(request.id, "decline")}>Decline</Button>
            </div>
          ))}
        </Panel>
      )}

      <Panel className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5" /> Interests</h2>
        <p className="text-xs text-muted-foreground">Choose topics that describe what you enjoy.</p>
        <div className="flex flex-wrap gap-2">{interests.map(i=><Chip key={i} active={selectedInterests.includes(i)} onClick={()=>setSelectedInterests(current=>current.includes(i)?current.filter(x=>x!==i):[...current,i])}>{i}</Chip>)}</div>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="font-semibold">Sharing permissions</h2>
        <p className="text-xs text-muted-foreground">Choose which parts of your Pulse Passport can be shared.</p>
        {Object.entries(share).map(([key, value])=><div key={key} className="flex items-center justify-between rounded-xl border px-3 py-2"><span className="text-sm capitalize">Share {key}</span><Switch checked={Boolean(value)} onCheckedChange={next=>setShare(current=>({...current,[key]:next}))} /></div>)}
      </Panel>

      {accountType==="creator" && <Panel className="space-y-3"><h2 className="font-semibold">Creator Studio</h2><CreatorStudio /></Panel>}
      {accountType==="business" && <Panel className="space-y-3"><h2 className="font-semibold">Business Suite</h2><BusinessSuite /></Panel>}

      <Panel className="space-y-3 border border-destructive/40">
        <div>
          <h2 className="flex items-center gap-2 font-semibold text-destructive"><Trash2 className="h-5 w-5" /> Delete account permanently</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            This permanently deletes your NEXORA sign-in and profile, your posts and account-owned uploads. You will be signed out on your devices. You can register a new account later, but deleted data cannot be restored.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            If you own a Squad, ownership will be transferred to an active member. Squads without another active member will be removed with their content.
          </p>
        </div>
        <label className="block space-y-1 text-sm font-medium">
          Type DELETE MY ACCOUNT to continue
          <input
            value={deleteConfirmation}
            onChange={(event) => setDeleteConfirmation(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="DELETE MY ACCOUNT"
            className="w-full rounded-xl border border-destructive/40 bg-background px-3 py-2"
          />
        </label>
        <Button
          type="button"
          variant="destructive"
          className="w-full"
          disabled={saving || uploading || deletingAccount || deleteConfirmation !== "DELETE MY ACCOUNT"}
          onClick={() => void deleteAccount()}
        >
          {deletingAccount ? "Deleting account…" : "Permanently delete my account"}
        </Button>
      </Panel>

      <Button className="w-full" disabled={saving || uploading} onClick={()=>void save()}>{saving?"Saving…":"Save profile settings"}</Button>
    </div>
  );
}

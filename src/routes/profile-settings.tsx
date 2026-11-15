import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Camera, ShieldCheck, UserRound, BriefcaseBusiness, Sparkles } from "lucide-react";
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

export const Route = createFileRoute("/profile-settings")({
  head: () => ({ meta: [{ title: "Profile settings — NEXORA" }] }),
  component: ProfileSettings,
});

const interests = ["city", "food", "tech", "music", "dance", "travel", "nature", "creators"];
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
  const [share, setShare] = useState<Record<string, boolean>>(passport.share as Record<string, boolean>);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let active = true;
    void (async () => {
      const { data, error } = await (supabase as any).from("profiles")
        .select("display_name, handle, bio, avatar_url, account_type, profile_category, private_profile, interests")
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
        setSelectedInterests(Array.isArray(data?.interests) ? data.interests : passport.interests ?? []);
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, [user?.id]);

  async function save() {
    if (!user) return toast.error("Sign in to update your profile.");
    setSaving(true);
    const cleanHandle = handle.trim().replace(/^@/, "");
    const { error } = await (supabase as any).from("profiles").upsert({
      id: user.id, display_name: name.trim(), handle: cleanHandle, bio: bio.trim(),
      account_type: accountType, profile_category: category || null,
      private_profile: privateProfile, interests: selectedInterests,
    });
    if (!error) {
      const { error: authError } = await supabase.auth.updateUser({ data: {
        display_name: name.trim(), handle: cleanHandle, bio: bio.trim(),
        account_type: accountType, profile_category: category || null, private_profile: privateProfile,
      } });
      if (authError) console.error("Auth metadata sync warning:", authError);
      updatePassport({ name: name.trim(), handle: cleanHandle, bio: bio.trim(), interests: selectedInterests });
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
        <h2 className="flex items-center gap-2 font-semibold"><BriefcaseBusiness className="h-5 w-5" /> Account type</h2>
        <div className="grid gap-2 sm:grid-cols-3">
          {([{value:"personal",label:"Personal",desc:"Social and discovery features."},{value:"creator",label:"Creator",desc:"Creator Studio and monetization."},{value:"business",label:"Business",desc:"Business tools and storefront."}] as const).map(t=><button key={t.value} type="button" onClick={()=>setAccountType(t.value)} className={`rounded-xl border p-3 text-left ${accountType===t.value?"border-primary bg-primary/10":"hover:bg-muted"}`}><p className="font-semibold">{t.label}</p><p className="mt-1 text-xs text-muted-foreground">{t.desc}</p></button>)}
        </div>
        {(accountType==="creator" || accountType==="business") && <div className="space-y-2"><p className="text-sm font-medium">Profile category</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{categories.map(([value,label])=><button key={value} type="button" onClick={()=>setCategory(value)} className={`rounded-lg border p-2 text-xs ${category===value?"border-primary bg-primary/10":"hover:bg-muted"}`}>{label}</button>)}</div></div>}
        <ProfileBadges accountType={accountType} industryTag={categories.find(([v])=>v===category)?.[1] ?? "Tech & Gaming"} isVerified />
      </Panel>

      <Panel className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-5 w-5" /> Privacy</h2>
        <div className="flex items-center justify-between gap-3"><div><p className="text-sm font-medium">Public profile</p><p className="text-xs text-muted-foreground">{privateProfile?"Only approved followers can see your profile and posts.":"Anyone can discover your profile and public posts."}</p></div><Switch checked={!privateProfile} onCheckedChange={v=>setPrivateProfile(!v)} /></div>
      </Panel>

      <Panel className="space-y-3">
        <h2 className="flex items-center gap-2 font-semibold"><Sparkles className="h-5 w-5" /> Interests</h2>
        <p className="text-xs text-muted-foreground">Choose topics that describe what you enjoy.</p>
        <div className="flex flex-wrap gap-2">{interests.map(i=><Chip key={i} active={selectedInterests.includes(i)} onClick={()=>setSelectedInterests(current=>current.includes(i)?current.filter(x=>x!==i):[...current,i])}>{i}</Chip>)}</div>
      </Panel>

      {accountType==="creator" && <Panel className="space-y-3"><h2 className="font-semibold">Creator Studio</h2><CreatorStudio /></Panel>}
      {accountType==="business" && <Panel className="space-y-3"><h2 className="font-semibold">Business Suite</h2><BusinessSuite /></Panel>}

      <Button className="w-full" disabled={saving || uploading} onClick={()=>void save()}>{saving?"Saving…":"Save profile settings"}</Button>
    </div>
  );
}

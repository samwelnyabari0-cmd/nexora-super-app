import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { KeyRound, LogOut, Mail, ShieldCheck, User as UserIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/account")({
  head: () => ({ meta: [{ title: "Account settings — NEXORA" }] }),
  component: Account,
});

type Tab = "profile" | "security" | "sessions";
type Factor = { id: string; status: string };

function Account() {
  const { user, ready } = useSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("profile");

  if (ready && !user) {
    return (
      <div>
        <PageHeader title="Account" subtitle="Sign in to manage your account" />
        <Button asChild><Link to="/auth">Sign in</Link></Button>
      </div>
    );
  }
  if (!user) return null;

  async function signOut(scope: "local" | "others" | "global") {
    const { error } = await supabase.auth.signOut({ scope });
    if (error) return toast.error("Could not sign out. Please try again.");
    if (scope === "others") return toast.success("Signed out of your other devices.");
    void navigate({ to: "/auth" });
  }

  const tabs: { id: Tab; label: string; icon: typeof UserIcon }[] = [
    { id: "profile", label: "Profile", icon: UserIcon },
    { id: "security", label: "Security", icon: ShieldCheck },
    { id: "sessions", label: "Sessions", icon: LogOut },
  ];

  return (
    <div className="space-y-4">
      <PageHeader title="Account settings" subtitle={user.email ?? ""} />
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(({ id, label, icon: Icon }) => (
          <Button key={id} variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
            <Icon size={16} className="mr-2" /> {label}
          </Button>
        ))}
      </div>
      {tab === "profile" && <ProfileTab />}
      {tab === "security" && <SecurityTab />}
      {tab === "sessions" && <SessionsTab onSignOut={signOut} />}
    </div>
  );
}

function ProfileTab() {
  const { user } = useSession();
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const [name, setName] = useState(meta.display_name ?? meta.full_name ?? "");
  const [handle, setHandle] = useState(meta.handle ?? "");
  const [bio, setBio] = useState(meta.bio ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function saveProfile(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({
      data: { display_name: name.trim(), handle: handle.trim().replace(/^@/, ""), bio: bio.trim() },
    });
    setBusy(false);
    error ? toast.error("Could not save profile.") : toast.success("Profile saved.");
  }

  async function changeEmail(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ email: email.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    setEmail("");
    toast.success("Check your new inbox (and the old one) to confirm the change.");
  }

  return (
    <div className="space-y-4">
      <Panel>
        <form onSubmit={saveProfile} className="space-y-3">
          <div><Label htmlFor="name">Display name</Label><Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></div>
          <div><Label htmlFor="handle">Creator handle</Label><Input id="handle" value={handle} onChange={(e) => setHandle(e.target.value)} maxLength={30} /></div>
          <div><Label htmlFor="bio">Bio</Label><Input id="bio" value={bio} onChange={(e) => setBio(e.target.value)} maxLength={160} /></div>
          <Button type="submit" disabled={busy}>Save changes</Button>
        </form>
      </Panel>
      <Panel>
        <form onSubmit={changeEmail} className="space-y-3">
          <p className="flex items-center gap-2 text-sm"><Mail size={16} /> Current email: {user?.email}</p>
          <Label htmlFor="email">New email</Label>
          <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button type="submit" variant="outline" disabled={busy || !email}>Change email</Button>
        </form>
      </Panel>
    </div>
  );
}

function SecurityTab() {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [factors, setFactors] = useState<Factor[]>([]);
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");

  async function loadFactors() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []) as Factor[]);
  }
  useEffect(() => { void loadFactors(); }, []);

  async function changePassword(e: FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Use at least 8 characters.");
    if (pw !== confirm) return toast.error("Passwords do not match.");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) return toast.error(error.message);
    setPw(""); setConfirm("");
    toast.success("Password updated.");
  }

  async function startEnroll() {
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error || !data) return toast.error("Could not start 2FA setup.");
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnroll(e: FormEvent) {
    e.preventDefault();
    if (!enroll) return;
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code: code.trim() });
    if (error) return toast.error("That code did not work. Try again.");
    setEnroll(null); setCode("");
    toast.success("Two-factor authentication is on.");
    void loadFactors();
  }

  async function disable(id: string) {
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) return toast.error("Could not turn off 2FA.");
    toast.success("Two-factor authentication is off.");
    void loadFactors();
  }

  const active = factors.find((f) => f.status === "verified");

  return (
    <div className="space-y-4">
      <Panel>
        <form onSubmit={changePassword} className="space-y-3">
          <p className="flex items-center gap-2 font-medium"><KeyRound size={16} /> Change password</p>
          <Input type="password" autoComplete="new-password" placeholder="New password" value={pw} onChange={(e) => setPw(e.target.value)} />
          <Input type="password" autoComplete="new-password" placeholder="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" disabled={busy || !pw}>Update password</Button>
        </form>
      </Panel>
      <Panel>
        <p className="mb-2 flex items-center gap-2 font-medium"><ShieldCheck size={16} /> Two-factor authentication</p>
        {active ? (
          <Button variant="outline" onClick={() => void disable(active.id)}>Turn off 2FA</Button>
        ) : enroll ? (
          <form onSubmit={verifyEnroll} className="space-y-3">
            <img src={enroll.qr} alt="Scan with your authenticator app" className="h-40 w-40 rounded bg-white p-2" />
            <p className="break-all text-xs text-muted-foreground">Or enter this key: {enroll.secret}</p>
            <Input inputMode="numeric" placeholder="6-digit code" value={code} onChange={(e) => setCode(e.target.value)} maxLength={6} />
            <Button type="submit" disabled={code.length !== 6}>Verify and enable</Button>
          </form>
        ) : (
          <Button onClick={() => void startEnroll()}>Set up authenticator app</Button>
        )}
      </Panel>
    </div>
  );
}

function SessionsTab({ onSignOut }: { onSignOut: (scope: "local" | "others" | "global") => Promise<void> }) {
  return (
    <Panel>
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">You are signed in on this device.</p>
        <Button variant="outline" onClick={() => void onSignOut("local")}><LogOut size={16} className="mr-2" /> Log out of this device</Button>
        <Button variant="outline" onClick={() => void onSignOut("others")}>Log out of other devices</Button>
        <Button variant="destructive" onClick={() => void onSignOut("global")}>Log out everywhere</Button>
      </div>
    </Panel>
  );
}

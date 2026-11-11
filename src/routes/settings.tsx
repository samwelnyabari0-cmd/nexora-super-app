import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ChevronRight, LogOut, ShieldCheck, Wallet, CreditCard } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useWorkspace, type Preferences } from "@/features/core/workspace";
import { creators } from "@/features/core/data";
import { PageHeader } from "@/components/nexora/ui";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Privacy, safety & accessibility — NEXORA" },
      {
        name: "description",
        content: "Manage account privacy, muted creators, notifications and accessibility.",
      },
      { property: "og:title", content: "Privacy, safety & accessibility — NEXORA" },
      {
        property: "og:description",
        content: "Manage account privacy, muted creators, notifications and accessibility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});
function Settings() {
  const { preferences, setPreferences, muted, toggleMute } = useWorkspace();
  const { user } = useSession();
  const navigate = useNavigate();
  const meta = (user?.user_metadata ?? {}) as Record<string, string | undefined>;
  const shownName = meta.display_name ?? meta.full_name ?? user?.email?.split("@")[0] ?? "Nexora user";

  async function logOut() {
    const { error } = await supabase.auth.signOut();
    if (error) return toast.error("Could not log out. Please try again.");
    void navigate({ to: "/auth" });
  }
  const [savedReports, setSavedReports] = useState<Array<{ target_id: string; reason: string; status: string }>>([]);

  useEffect(() => {
    if (!user) return;
    void (supabase as any)
      .from("reports")
      .select("target_id, reason, status")
      .order("created_at", { ascending: false })
      .then(({ data, error }: { data: Array<{ target_id: string; reason: string; status: string }> | null; error: unknown }) => {
        if (!error && data) setSavedReports(data);
      });
    void (supabase as any)
      .from("profiles")
      .select("settings")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data, error }: { data: { settings?: Record<string, boolean> } | null; error: unknown }) => {
        if (!error && data?.settings) setPreferences((current) => ({ ...current, ...data.settings }));
      });
  }, [setPreferences, user]);

  function updatePreference(key: keyof Preferences, value: boolean) {
    setPreferences((current) => {
      const next = { ...current, [key]: value };
      if (user) void (supabase as any).from("profiles").upsert({ id: user.id, settings: next });
      return next;
    });
  }

  const groups: { title: string; fields: { key: keyof Preferences; label: string }[] }[] = [
    {
      title: "Privacy",
      fields: [
        { key: "privateProfile", label: "Private profile" },
        { key: "allowMessages", label: "Allow composing messages" },
      ],
    },
    {
      title: "Notifications",
      fields: [{ key: "activityNotices", label: "Activity notifications" }],
    },
    {
      title: "Accessibility",
      fields: [
        { key: "largeText", label: "Larger text" },
        { key: "reduceMotion", label: "Reduce motion" },
        { key: "highContrast", label: "Higher contrast" },
      ],
    },
  ];
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" subtitle={user ? "Saved to your account" : "Sign in to sync settings"} />
      {user ? (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-bold text-primary-foreground">
              {shownName[0]?.toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-semibold">{shownName}</p>
              <p className="text-xs text-muted-foreground">{meta.handle ? `@${meta.handle}` : user.email}</p>
            </div>
          </div>
          <Button asChild variant="outline"><Link to="/account">Edit</Link></Button>
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-2xl border p-4">
          <div>
            <p className="text-sm font-semibold">Sign in to sync settings</p>
            <p className="text-xs text-muted-foreground">Wallet, preferences and profile</p>
          </div>
          <Button asChild><Link to="/auth">Sign in</Link></Button>
        </div>
      )}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Account & payments</h2>
        {[
          { to: "/account", label: "Account & security", icon: ShieldCheck },
          { to: "/wallet", label: "Wallet & payouts", icon: Wallet },
          { to: "/subscriptions", label: "Subscriptions", icon: CreditCard },
        ].map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex items-center justify-between border-b py-4">
            <span className="flex items-center gap-3 text-sm"><Icon size={18} /> {label}</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </Link>
        ))}
      </section>
      {groups.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{g.title}</h2>
          {g.fields.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4 border-b py-4">
              <span className="text-sm">{label}</span>
              <Switch
                aria-label={label}
                checked={preferences[key]}
                onCheckedChange={(v) => updatePreference(key, v)}
              />
            </label>
          ))}
        </section>
      ))}
      <section className="mb-8">
        <h2 className="mb-3 text-lg font-semibold">Muted creators</h2>
        {muted.length ? (
          muted.map((id) => (
            <div key={id} className="flex items-center justify-between border-b py-3">
              <span>{creators.find((c) => c.id === id)?.name ?? id}</span>
              <Button variant="outline" onClick={() => toggleMute(id)}>
                Unmute
              </Button>
            </div>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No muted creators.</p>
        )}
        <h3 className="mt-5 font-semibold">Safety reports</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {savedReports.length} reports submitted to the moderation queue.
        </p>
        <ul className="mt-2 text-sm">
          {savedReports.map((r, i) => (
            <li key={`${r.target_id}-${i}`} className="flex items-center justify-between gap-3 border-b py-2">
              <span>{r.target_id} · {r.reason}</span>
              <span className="text-xs text-muted-foreground">{r.status}</span>
            </li>
          ))}
        </ul>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <Link to="/subscriptions">View subscription plans</Link>
        </Button>
        <Button asChild variant="outline">
          <Link to="/help">Help center</Link>
        </Button>
      </div>
      {user && (
        <Button variant="outline" className="mt-8 w-full text-destructive" onClick={() => void logOut()}>
          <LogOut size={16} className="mr-2" /> Log out
        </Button>
      )}
    </div>
  );
                   }

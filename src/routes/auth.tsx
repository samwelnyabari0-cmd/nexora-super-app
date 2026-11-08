import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { BadgeCheck, LogOut, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const authRedirectUrl = () => import.meta.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || import.meta.env.VITE_SUPABASE_REDIRECT_URL || `${window.location.origin}/auth`;
import { useSession } from "@/lib/session";
import { PageHeader, Panel } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — NEXORA" },
        {
          name: "description",
          content: "Sign in with Google to sync your Hub, wallet ledger and preferences. Exploring needs no account.",
        },
        { property: "og:title", content: "Sign in — NEXORA" },
      { property: "og:description", content: "Optional account: sync your Hub and ledger across devices." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { user, ready } = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(mode);
    try {
      const result = mode === "sign-in"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              emailRedirectTo: authRedirectUrl(),
            },
          });
      if (result.error) {
        const message = result.error.message.toLowerCase().includes("confirm")
          ? "Check your email to confirm your account before signing in."
          : mode === "sign-in" ? "Invalid email or password." : "Unable to create the account. Check the details and try again.";
        toast.error(message);
      } else if (mode === "sign-up") {
        toast.success("Account created. Check your email to confirm it, then sign in.");
        setMode("sign-in");
      } else {
        toast.success("Signed in");
      }
    } finally {
      setBusy(null);
    }
  }

  async function signInWithGoogle() {
    setBusy("google");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: authRedirectUrl(),
        },
      });
      if (error) toast.error("Google sign-in is unavailable right now. Try email and password instead.");
    } finally {
      setBusy(null);
    }
  }

  async function signOut() {
    setBusy("out");
    try {
      await supabase.auth.signOut();
      toast.success("Signed out — your device data stays on this device");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Account" />
      <Panel className="space-y-4">
        {ready && user ? (
          <>
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-primary/15 text-primary">
                <BadgeCheck className="h-6 w-6" />
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold">{user.email ?? "Signed in"}</p>
                <p className="text-sm text-success">Signed in · your data syncs to your account</p>
              </div>
            </div>
            <ul className="space-y-1 text-sm text-muted-foreground">
              <li>· Hub mini-apps, tasks, notes, subscriptions and budget sync across devices.</li>
              <li>· Wallet transfers you make while signed in are kept in your private account ledger.</li>
              <li>· Wallet balances remain simulated — no real money is involved.</li>
            </ul>
            <Button variant="outline" onClick={signOut} disabled={busy === "out"} className="w-full">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              Sign in to use real club messages, shared events, dues, and cross-device account data.
            </p>
            <form className="space-y-3" onSubmit={(event) => void submitAuth(event)}>
              <label className="block text-sm font-medium" htmlFor="auth-email">Email</label>
              <input id="auth-email" type="email" required autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border bg-background px-3 py-2" />
              <label className="block text-sm font-medium" htmlFor="auth-password">Password</label>
              <input id="auth-password" type="password" required minLength={8} autoComplete={mode === "sign-in" ? "current-password" : "new-password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border bg-background px-3 py-2" />
                <Button type="submit" disabled={busy !== null} className="w-full">
                {mode === "sign-in" ? "Sign in" : "Create account"}
              </Button>
            </form>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              <span>or</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void signInWithGoogle()} className="w-full">
              Continue with Google
            </Button>
            <button type="button" className="w-full text-sm underline" onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}>
              {mode === "sign-in" ? "Need an account? Create one" : "Already have an account? Sign in"}
            </button>
            {busy && busy !== "out" && <p className="text-xs text-muted-foreground">Working…</p>}
          </>
        )}
      </Panel>
      <Panel className="mt-4 space-y-2">
        <p className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-4 w-4 text-success" /> Your account, your control
        </p>
        <p className="text-sm text-muted-foreground">
          Your profile, posts and privacy choices follow your account across devices. You can switch your profile between public and private at any time.
        </p>
      </Panel>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline">Back to NEXORA</Link>
      </p>
    </div>
  );
}

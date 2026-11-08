import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CloudCog, LogOut, ShieldCheck } from "lucide-react";
import { lovable } from "@/integrations/lovable";
import { supabase } from "@/integrations/supabase/client";
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

  async function signIn(provider: "google") {
    setBusy(provider);
    try {
      const res = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: window.location.origin,
      });
      if (res && !res.redirected && res.error) {
        toast.error("Sign-in didn't complete", {
          description: res.error instanceof Error ? res.error.message : "Please try again.",
        });
      }
      // redirected: browser navigates; otherwise the session listener updates this page.
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
              You can explore every part of NEXORA without an account. Signing in simply saves your
              Hub, wallet ledger and preferences to your account so they follow you across devices.
            </p>
            <Button variant="outline" onClick={() => signIn("google")} disabled={busy !== null} className="w-full">
              Continue with Google
            </Button>
            {busy && busy !== "out" && <p className="text-xs text-muted-foreground">Opening sign-in…</p>}
          </>
        )}
      </Panel>
      <Panel className="mt-4 space-y-2">
        <p className="flex items-center gap-2 font-display font-semibold">
          <ShieldCheck className="h-4 w-4 text-success" /> What stays on this device
        </p>
        <p className="text-sm text-muted-foreground">
          Feed likes, messages, drafts, saved collections and the offline relay are session-local by
          design until messaging and feed backends are connected. Signing in does not upload them.
        </p>
        <p className="flex items-center gap-2 font-display font-semibold">
          <CloudCog className="h-4 w-4 text-accent" /> Not connected yet
        </p>
        <p className="text-sm text-muted-foreground">
          Real payments (M-Pesa/Paystack/Stripe) and live AI, maps and streaming providers are not
          wired up — those features stay clearly labelled demo or simulated.
        </p>
      </Panel>
      <p className="mt-4 text-center text-sm text-muted-foreground">
        <Link to="/" className="underline">Back to NEXORA</Link>
      </p>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Panel } from "@/components/nexora/ui";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [message, setMessage] = useState("Completing Google sign-in…");

  useEffect(() => {
    let active = true;

    async function completeOAuth() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const errorDescription = params.get("error_description") || params.get("error");

      if (errorDescription) {
        if (active) setMessage("Google sign-in was cancelled or denied.");
        window.setTimeout(() => void navigate({ to: "/auth" }), 900);
        return;
      }

      if (!code) {
        if (active) setMessage("The Google sign-in link is incomplete.");
        window.setTimeout(() => void navigate({ to: "/auth" }), 900);
        return;
      }

      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        if (active) setMessage("Google sign-in could not be completed. Please try again.");
        window.setTimeout(() => void navigate({ to: "/auth" }), 1200);
        return;
      }

      void navigate({ to: "/" });
    }

    void completeOAuth();
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="mx-auto max-w-xl">
      <Panel className="grid min-h-40 place-items-center gap-3 text-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
        <p>{message}</p>
      </Panel>
    </div>
  );
}

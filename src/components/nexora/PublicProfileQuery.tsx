
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

type PublicProfileRecord = {
  id: string;
  display_name: string | null;
  handle: string;
  bio: string | null;
  private_profile: boolean;
  settings: Record<string, unknown> | null;
};

export function PublicProfileQuery({ handle }: { handle: string }) {
  const [profile, setProfile] = useState<PublicProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      setLoading(true);
      setError("");
      setProfile(null);

      const { data, error: fetchError } = await (supabase as any)
        .rpc("get_public_profile", { p_handle: handle });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || "Unable to load this profile.");
        setLoading(false);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        setError("This profile does not exist or is not publicly available.");
        setLoading(false);
        return;
      }

      setProfile(row as PublicProfileRecord);
      setLoading(false);
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [handle]);

  if (loading) {
    return (
      <div className="mx-auto max-w-xl p-8 text-center">
        Loading public profile...
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="mx-auto max-w-xl space-y-4 p-8 text-center">
        <h2 className="text-xl font-bold">Profile unavailable</h2>
        <p className="text-sm text-muted-foreground">
          {error || "This profile could not be found."}
        </p>
        <Link to="/profile" className="text-primary underline">
          Return to my profile
        </Link>
      </div>
    );
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-4">
      <Link to="/profile" className="text-sm text-primary underline">
        ← Back to profile
      </Link>

      <section className="rounded-2xl border bg-card p-6">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold">
            {(profile.display_name || profile.handle)
              .charAt(0)
              .toUpperCase()}
          </div>

          <div className="min-w-0">
            <h1 className="text-xl font-bold">
              {profile.display_name || "NEXORA User"}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{profile.handle}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t pt-4">
          <h2 className="mb-2 font-semibold">About</h2>
          <p className="whitespace-pre-wrap text-sm">
            {profile.bio || "No bio added yet."}
          </p>
        </div>

        <p className="mt-5 text-xs text-muted-foreground">
          NEXORA Public Profile
        </p>
      </section>
    </main>
  );
}

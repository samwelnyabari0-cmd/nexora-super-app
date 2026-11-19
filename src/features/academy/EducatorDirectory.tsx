import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Search, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { filterEducators, type AcademyEducator } from "./educatorDirectory";

const skillFilters = ["React", "WebGL", "UI/UX", "Video Editing"];

export function EducatorDirectory({
  onSelectEducator,
}: {
  onSelectEducator: (educatorId: string) => void;
}) {
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [skill, setSkill] = useState("");
  const [educators, setEducators] = useState<AcademyEducator[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setEducators([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      const { data, error: searchError } = await (supabase as any).rpc(
        "search_academy_educators",
        {
          p_query: query.trim() || null,
          p_skill: skill || null,
          p_limit: 50,
          p_offset: 0,
        },
      );

      if (!active) return;
      if (searchError) {
        setError(searchError.message || "Could not search educators.");
        setEducators([]);
      } else {
        setEducators(Array.isArray(data) ? data : []);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [user?.id, query, skill]);

  const visibleEducators = useMemo(
    () => filterEducators(educators, query, skill),
    [educators, query, skill],
  );

  if (!user) {
    return (
      <section className="rounded-2xl border bg-card p-6 text-center">
        <GraduationCap className="mx-auto h-8 w-8 text-primary" />
        <h3 className="mt-3 font-semibold">Discover educators on Nexora</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Sign in to search public, discoverable Education profiles.
        </p>
        <Button asChild className="mt-4">
          <a href="/auth">Sign in</a>
        </Button>
      </section>
    );
  }

  return (
    <section className="space-y-4" aria-label="Instructors and creators">
      <label className="flex items-center gap-2 rounded-xl border bg-card px-3 py-3 text-sm">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Search instructors and creators</span>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, @handle, bio or skill…"
          className="w-full bg-transparent outline-none placeholder:text-muted-foreground"
        />
      </label>

      <div className="flex flex-wrap gap-2" aria-label="Filter by education skill">
        {skillFilters.map((item) => (
          <button
            type="button"
            key={item}
            aria-pressed={skill === item}
            onClick={() => setSkill((current) => current === item ? "" : item)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${skill === item ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Education creators</p>
          <p className="text-xs text-muted-foreground">
            Creator + Education and Business + Education profiles
          </p>
        </div>
        <span className="text-xs text-muted-foreground">
          {visibleEducators.length} found
        </span>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
          Searching educators…
        </div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-destructive/40 bg-card p-5 text-sm text-destructive">
          {error}
        </div>
      ) : visibleEducators.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-card p-7 text-center">
          <UserRound className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">No educators found yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try another name or skill. Educators appear here when their Education profile is public and discoverable.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleEducators.map((educator) => (
            <article key={educator.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start gap-3">
                {educator.avatar_url ? (
                  <img src={educator.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                    <UserRound className="h-5 w-5" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">{educator.display_name || educator.handle || "Education creator"}</p>
                  {educator.handle && <p className="truncate text-xs text-muted-foreground">@{educator.handle.replace(/^@/, "")}</p>}
                  <p className="mt-1 text-xs text-muted-foreground">
                    {educator.account_type === "business" ? "Business · Education" : "Creator · Education"}
                  </p>
                </div>
              </div>
              {educator.bio && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{educator.bio}</p>}
              {educator.education_skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {educator.education_skills.slice(0, 5).map((item) => (
                    <span key={item} className="rounded-full bg-muted px-2.5 py-1 text-[11px]">{item}</span>
                  ))}
                </div>
              )}
              <Button type="button" variant="outline" className="mt-4 w-full" onClick={() => onSelectEducator(educator.id)}>
                View educator showcase
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

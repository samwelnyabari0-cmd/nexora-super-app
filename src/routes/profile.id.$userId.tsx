import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicProfileById } from "./profile.$handle";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/profile/id/$userId")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : "",
  }),
  head: () => ({ meta: [{ title: "Profile & Pulse Passport — NEXORA" }] }),
  component: PublicProfileIdRoute,
});

function PublicProfileIdRoute() {
  const { userId } = Route.useParams();
  const { post } = Route.useSearch();
  if (!UUID_PATTERN.test(userId)) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Profile unavailable</h1>
        <p className="text-sm text-muted-foreground">This profile link is invalid or no longer available.</p>
        <Link to="/explore" className="text-sm font-semibold text-primary">Back to Explore</Link>
      </main>
    );
  }
  return (
    <div className="space-y-2">
      <aside className="mx-3 mt-2 rounded-md border border-sky-500/40 bg-sky-950/40 p-2 font-mono text-[10px] leading-4 text-sky-100" aria-label="Temporary profile route diagnostic">
        <div className="font-bold tracking-wide">TEMP DEBUG — ROUTE</div>
        <div>Matched route: /profile/id/$userId</div>
        <div>Route userId: {userId}</div>
        <div>Post query: {post || "none"}</div>
      </aside>
      <PublicProfileById userId={userId} requestedPostId={post} />
    </div>
  );
}

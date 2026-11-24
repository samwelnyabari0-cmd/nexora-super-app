import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicProfileById } from "./profile.$handle";
import { isValidProfileUserId } from "@/lib/profile-navigation";

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
  if (!isValidProfileUserId(userId)) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Profile unavailable</h1>
        <p className="text-sm text-muted-foreground">This profile link is invalid or no longer available.</p>
        <Link to="/explore" className="text-sm font-semibold text-primary">Back to Explore</Link>
      </main>
    );
  }
  return <PublicProfileById userId={userId} requestedPostId={post} />;
}

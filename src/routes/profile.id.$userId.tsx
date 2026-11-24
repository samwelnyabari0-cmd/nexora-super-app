import { createFileRoute, Link } from "@tanstack/react-router";
import { PublicProfileById } from "./profile.$handle";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/profile/id/$userId")({
  head: () => ({ meta: [{ title: "Profile & Pulse Passport — NEXORA" }] }),
  component: PublicProfileIdRoute,
});

function PublicProfileIdRoute() {
  const { userId } = Route.useParams();
  if (!UUID_PATTERN.test(userId)) {
    return (
      <main className="mx-auto flex min-h-[50vh] max-w-lg flex-col items-center justify-center gap-3 p-6 text-center">
        <h1 className="text-lg font-semibold">Profile unavailable</h1>
        <p className="text-sm text-muted-foreground">This profile link is invalid or no longer available.</p>
        <Link to="/explore" className="text-sm font-semibold text-primary">Back to Explore</Link>
      </main>
    );
  }
  return <PublicProfileById userId={userId} />;
}

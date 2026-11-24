import { createFileRoute } from "@tanstack/react-router";

import { PublicProfileByIdentity } from "@/routes/profile.$handle";

export const Route = createFileRoute("/profile/id/$userId")({
  validateSearch: (search: Record<string, unknown>) => ({
    post: typeof search.post === "string" ? search.post : "",
  }),
  head: () => ({
    meta: [
      { title: "Profile & Pulse Passport — NEXORA" },
      {
        name: "description",
        content: "Explore a NEXORA creator's public Pulse Passport and posts.",
      },
    ],
  }),
  component: IdProfileRouteComponent,
});

function IdProfileRouteComponent() {
  const { userId } = Route.useParams();
  const { post } = Route.useSearch();

  return (
    <PublicProfileByIdentity
      key={`id:${userId.toLowerCase()}`}
      identity={{ type: "id", value: userId }}
      requestedPostId={post}
    />
  );
}

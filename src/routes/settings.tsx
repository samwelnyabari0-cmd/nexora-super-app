import { createFileRoute, Link } from "@tanstack/react-router";
import { useWorkspace, type Preferences } from "@/features/core/workspace";
import { creators } from "@/features/core/data";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Privacy, safety & accessibility — NEXORA" },
      {
        name: "description",
        content: "Manage demo privacy, muted creators, notifications and accessibility.",
      },
      { property: "og:title", content: "Privacy, safety & accessibility — NEXORA" },
      {
        property: "og:description",
        content: "Manage demo privacy, muted creators, notifications and accessibility.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Settings,
});
function Settings() {
  const { preferences, setPreferences, muted, toggleMute, reports } = useWorkspace();
  const groups: { title: string; fields: { key: keyof Preferences; label: string }[] }[] = [
    {
      title: "Privacy",
      fields: [
        { key: "privateProfile", label: "Private profile (local demo)" },
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
      <PageHeader title="Settings" action={<DemoBadge>Session only</DemoBadge>} />
      {groups.map((g) => (
        <section key={g.title} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{g.title}</h2>
          {g.fields.map(({ key, label }) => (
            <label key={key} className="flex items-center justify-between gap-4 border-b py-4">
              <span className="text-sm">{label}</span>
              <Switch
                aria-label={label}
                checked={preferences[key]}
                onCheckedChange={(v) => setPreferences((p) => ({ ...p, [key]: v }))}
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
        <p className="mt-2 text-sm text-warning">
          {reports.length} reports saved locally. Reports are not sent to moderators.
        </p>
        <ul className="mt-2 text-sm">
          {reports.map((r, i) => (
            <li key={i} className="border-b py-2">
              {r.target} · {r.reason}
            </li>
          ))}
        </ul>
      </section>
      <Button asChild variant="outline">
        <Link to="/help">Help center</Link>
      </Button>
    </div>
  );
}

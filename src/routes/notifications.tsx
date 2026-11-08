import { createFileRoute } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";
import { useWorkspace } from "@/features/core/workspace";
import { enablePushNotifications } from "@/lib/push";
import { toast } from "sonner";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — NEXORA" },
      { name: "description", content: "Session activity and safety notifications." },
      { property: "og:title", content: "Notifications — NEXORA" },
      { property: "og:description", content: "Session activity and safety notifications." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Notifications,
});
function Notifications() {
  const { notices, markRead } = useWorkspace();
  return (
    <div>
      <PageHeader title="Notifications" action={<DemoBadge>Local activity</DemoBadge>} />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => markRead()} disabled={!notices.some((n) => !n.read)}>
          <CheckCheck />
          Mark all read
        </Button>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await enablePushNotifications();
              toast.success("Push notifications enabled on this device.");
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Could not enable notifications.");
            }
          }}
        >
          <Bell />
          Enable push notifications
        </Button>
      </div>
      <ul className="mt-4">
        {notices.map((n) => (
          <li key={n.id} className="border-b py-4">
            <Button
              className="h-auto w-full justify-start whitespace-normal text-left"
              variant="ghost"
              onClick={() => markRead(n.id)}
            >
              <Bell className={n.read ? "text-muted-foreground" : "text-accent"} />
              <span>
                <span className="block font-semibold">
                  {n.title}
                  {!n.read && " · New"}
                </span>
                <span className="block text-sm text-muted-foreground">{n.detail}</span>
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {!notices.length && (
        <p className="py-16 text-center text-muted-foreground">You’re all caught up.</p>
      )}
    </div>
  );
}

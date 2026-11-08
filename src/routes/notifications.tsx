import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useWorkspace } from "@/features/core/workspace";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
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
  const { notices: localNotices, markRead } = useWorkspace();
  const { user } = useSession();
  const [remoteNotices, setRemoteNotices] = useState<
    Array<{ id: string; body: string; read_at: string | null; created_at: string }>
  >([]);
  useEffect(() => {
    if (!user) return;
    void (async () => {
      const { data } = await (supabase as any)
        .from("notifications")
        .select("id, body, read_at, created_at")
        .eq("recipient_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setRemoteNotices(data ?? []);
    })();
  }, [user]);
  const notices = [
    ...remoteNotices.map((n) => ({
      id: n.id,
      title: "Activity",
      detail: n.body,
      read: Boolean(n.read_at),
    })),
    ...localNotices,
  ];
  async function markAllRead() {
    markRead();
    if (user)
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("recipient_id", user.id)
        .is("read_at", null);
    setRemoteNotices((items) =>
      items.map((item) => ({ ...item, read_at: new Date().toISOString() })),
    );
  }
  async function markOneRead(id: string) {
    if (remoteNotices.some((item) => item.id === id)) {
      await (supabase as any)
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);
      setRemoteNotices((items) =>
        items.map((item) =>
          item.id === id ? { ...item, read_at: new Date().toISOString() } : item,
        ),
      );
    } else markRead(id);
  }
  return (
    <div>
      <PageHeader title="Notifications" action={<DemoBadge>Synced activity</DemoBadge>} />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() => void markAllRead()}
          disabled={!notices.some((n) => !n.read)}
        >
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
              toast.error(
                error instanceof Error ? error.message : "Could not enable notifications.",
              );
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
              onClick={() => void markOneRead(n.id)}
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

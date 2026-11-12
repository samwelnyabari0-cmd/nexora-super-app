
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";

type Membership = {
  id: string;
  club_id: string;
  user_id: string;
  role: "creator" | "admin" | "member";
  status: "pending" | "active" | "banned";
};

export function ClubAdminPanel({ clubId }: { clubId: string }) {
  const { user, ready } = useSession();
  const [rows, setRows] = useState<Membership[]>([]);
  const [myRole, setMyRole] = useState<Membership["role"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [targetUserId, setTargetUserId] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) {
      setRows([]);
      setMyRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const { data, error } = await (
      supabase.from("club_memberships" as never) as any
    )
      .select("id,club_id,user_id,role,status")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    if (error) {
      setRows([]);
      setMyRole(null);
      toast.error("Unable to load club permissions.");
    } else {
      const memberships = (data ?? []) as Membership[];
      setRows(memberships);

      setMyRole(
        memberships.find(
          (m) => m.user_id === user.id && m.status === "active"
        )?.role ?? null
      );
    }

    setLoading(false);
  }, [clubId, user]);

  useEffect(() => {
    if (ready) void load();
  }, [ready, load]);

  const changeMembership = async (
    row: Membership,
    patch: {
      role?: Membership["role"];
      status?: Membership["status"];
    }
  ) => {
    setBusyId(row.id);

    const { error } = await (
      supabase.from("club_memberships" as never) as any
    )
      .update(patch)
      .eq("id", row.id);

    setBusyId(null);

    if (error) {
      toast.error("Change not permitted or could not be saved.");
    } else {
      toast.success("Membership updated.");
      await load();
    }
  };

  const appointAdmin = async () => {
    const id = targetUserId.trim();

    const validId =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!validId.test(id)) {
      toast.error("Enter a valid Supabase Auth user ID.");
      return;
    }

    setBusyId("appoint");

    const { error } = await (
      supabase.from("club_memberships" as never) as any
    ).insert({
      club_id: clubId,
      user_id: id,
      role: "admin",
      status: "active",
      appointed_by: user?.id,
    });

    setBusyId(null);

    if (error) {
      toast.error(
        "Appointment failed. Check the user ID and membership policies."
      );
    } else {
      setTargetUserId("");
      toast.success("Administrator appointed.");
      await load();
    }
  };

  if (!ready || loading) {
    return <p className="text-sm text-muted-foreground">Loading permissions…</p>;
  }

  if (!user) {
    return <p className="text-sm text-muted-foreground">Sign in to manage clubs.</p>;
  }

  if (myRole !== "creator" && myRole !== "admin") {
    return null;
  }

  const isCreator = myRole === "creator";

  return (
    <section className="mb-4 space-y-4 rounded-2xl border bg-card p-4">
      <div>
        <h3 className="font-display font-semibold">
          Club administration
        </h3>
        <p className="text-xs text-muted-foreground">
          Your role: {myRole}
        </p>
      </div>

      {isCreator && (
        <div className="space-y-2 rounded-xl bg-muted/50 p-3">
          <label className="text-sm font-medium">
            Appoint an administrator
          </label>

          <input
            value={targetUserId}
            onChange={(e) => setTargetUserId(e.target.value)}
            placeholder="Supabase Auth user ID"
            className="w-full rounded-xl border bg-background px-3 py-2 text-sm"
          />

          <Button
            size="sm"
            onClick={() => void appointAdmin()}
            disabled={!targetUserId.trim() || busyId === "appoint"}
          >
            {busyId === "appoint" ? "Appointing…" : "Appoint administrator"}
          </Button>

          <p className="text-xs text-muted-foreground">
            Only the creator can appoint administrators.
          </p>
        </div>
      )}

      <div className="space-y-2">
        <h4 className="text-sm font-semibold">
          Club members ({rows.length})
        </h4>

        {rows.map((row) => (
          <div
            key={row.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {row.user_id === user.id ? "You" : row.user_id}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.role} · {row.status}
              </p>
            </div>

            {row.role !== "creator" && (
              <div className="flex flex-wrap gap-2">
                {row.status === "pending" && (
                  <Button
                    size="sm"
                    onClick={() =>
                      void changeMembership(row, { status: "active" })
                    }
                    disabled={busyId === row.id}
                  >
                    Approve
                  </Button>
                )}

                {row.status !== "banned" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void changeMembership(row, { status: "banned" })
                    }
                    disabled={busyId === row.id}
                  >
                    Ban
                  </Button>
                )}

                {row.status === "banned" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void changeMembership(row, { status: "active" })
                    }
                    disabled={busyId === row.id}
                  >
                    Unban
                  </Button>
                )}

                {isCreator && row.role === "member" &&
                  row.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        void changeMembership(row, { role: "admin" })
                      }
                      disabled={busyId === row.id}
                    >
                      Make admin
                    </Button>
                  )}

                {isCreator && row.role === "admin" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void changeMembership(row, { role: "member" })
                    }
                    disabled={busyId === row.id}
                  >
                    Remove admin
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
  

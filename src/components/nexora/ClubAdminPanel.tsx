
import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Membership = {
  id: string;
  user_id: string;
  role: "creator" | "admin" | "member";
  status: "pending" | "active" | "banned";
  created_at: string;
  appointed_by: string | null;
};

type Props = {
  clubId: string;
};

export function ClubAdminPanel({ clubId }: Props) {
  const { user, ready } = useSession();

  const [members, setMembers] = useState<Membership[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminUserId, setAdminUserId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!user) {
      setMembers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await (
      supabase.from("club_memberships" as never) as any
    )
      .select(
        "id,user_id,role,status,created_at,appointed_by"
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    if (queryError) {
      setError("Unable to load club memberships.");
      setMembers([]);
    } else {
      setMembers((data ?? []) as Membership[]);
    }

    setLoading(false);
  }, [clubId, user]);

  useEffect(() => {
    if (ready) {
      void loadMembers();
    }
  }, [ready, loadMembers]);

  const currentMembership = members.find(
    (member) => member.user_id === user?.id
  );

  const isCreator = currentMembership?.role === "creator";
  const isAdmin =
    isCreator || currentMembership?.role === "admin";

  const isActive = currentMembership?.status === "active";

  const updateMembership = async (
    member: Membership,
    changes: Partial<Pick<Membership, "role" | "status">>
  ) => {
    if (!isAdmin || !isActive) {
      toast.error("You do not have permission to do that.");
      return;
    }

    if (member.role === "creator") {
      toast.error("The club creator cannot be changed here.");
      return;
    }

    if (!isCreator && member.role !== "member") {
      toast.error("Only the creator can manage administrators.");
      return;
    }

    setSaving(true);

    const { error: updateError } = await (
      supabase.from("club_memberships" as never) as any
    )
      .update(changes)
      .eq("id", member.id)
      .eq("club_id", clubId);

    setSaving(false);

    if (updateError) {
      toast.error(updateError.message || "Update failed.");
      return;
    }

    toast.success("Membership updated.");
    await loadMembers();
  };

  const appointAdmin = async () => {
    if (!isCreator || !isActive || !user) {
      toast.error("Only the active club creator can appoint admins.");
      return;
    }

    const newUserId = adminUserId.trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        newUserId
      )
    ) {
      toast.error("Enter a valid Supabase user UUID.");
      return;
    }

    if (newUserId === user.id) {
      toast.error("You are already the club creator.");
      return;
    }

    const existing = members.find(
      (member) => member.user_id === newUserId
    );

    if (existing) {
      if (existing.role === "creator") {
        toast.error("This user is already a creator.");
        return;
      }

      setSaving(true);

      const { error: updateError } = await (
        supabase.from("club_memberships" as never) as any
      )
        .update({ role: "admin", status: "active" })
        .eq("id", existing.id)
        .eq("club_id", clubId);

      setSaving(false);

      if (updateError) {
        toast.error(updateError.message || "Could not appoint admin.");
        return;
      }
    } else {
      setSaving(true);

      const { error: insertError } = await (
        supabase.from("club_memberships" as never) as any
      )
        .insert({
          club_id: clubId,
          user_id: newUserId,
          role: "admin",
          status: "active",
          appointed_by: user.id,
        });

      setSaving(false);

      if (insertError) {
        toast.error(insertError.message || "Could not appoint admin.");
        return;
      }
    }

    setAdminUserId("");
    toast.success("Club administrator appointed.");
    await loadMembers();
  };

  if (!ready) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Loading account...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-xl border p-4 text-sm text-muted-foreground">
        Sign in to access club membership management.
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold">Club administration</h2>
          <p className="text-sm text-muted-foreground">
            Membership, roles and club access
          </p>
          <div className="rounded-lg border border-yellow-500/40 p-3 text-xs">
  <p>DEBUG — Club ID: {clubId}</p>
  <p>DEBUG — App User ID: {user?.id ?? "No user"}</p>
  <p>DEBUG — App Email: {user?.email ?? "No email"}</p>
  <p>DEBUG — Membership rows: {members.length}</p>
  <p>DEBUG — Loading: {String(loading)}</p>
  <p>DEBUG — Query error: {error ?? "None"}
  </p> 
          </div>          
        </div>

        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
          {isCreator
            ? "Creator"
            : isAdmin
              ? "Administrator"
              : "Member"}
        </span>
      </div>

      {!isActive && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Your membership is not active. Admin controls are unavailable.
        </p>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          {error}
          <Button
            size="sm"
            variant="outline"
            className="ml-2"
            onClick={() => void loadMembers()}
          >
            Retry
          </Button>
        </div>
      )}

      {isCreator && isActive && (
        <div className="space-y-2 rounded-xl border p-3">
          <h3 className="font-semibold">Appoint an administrator</h3>
          <p className="text-xs text-muted-foreground">
            Enter the person's Supabase Auth user UUID.
          </p>

          <input
            value={adminUserId}
            onChange={(event) => setAdminUserId(event.target.value)}
            placeholder="Enter user UUID"
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm"
          />

          <Button
            onClick={() => void appointAdmin()}
            disabled={saving || !adminUserId.trim()}
            className="w-full"
          >
            Appoint administrator
          </Button>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Club members</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadMembers()}
            disabled={loading || saving}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">
            Loading memberships...
          </p>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No membership records found.
          </p>
        ) : (
          members.map((member) => (
            <div
              key={member.id}
              className="space-y-3 rounded-xl border p-3"
            >
              <div className="min-w-0">
                <p className="break-all text-xs text-muted-foreground">
                  User ID: {member.user_id}
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {member.role}
                  </span>

                  <span className="rounded-full bg-muted px-2 py-1 text-xs">
                    {member.status}
                  </span>
                </div>
              </div>

              {isAdmin &&
                isActive &&
                member.role !== "creator" && (
                  <div className="flex flex-wrap gap-2">
                    {member.status === "pending" && (
                      <Button
                        size="sm"
                        disabled={saving}
                        onClick={() =>
                          void updateMembership(member, {
                            status: "active",
                          })
                        }
                      >
                        Approve
                      </Button>
                    )}

                    {member.status !== "banned" &&
                      member.status !== "pending" && (
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={saving}
                          onClick={() =>
                            void updateMembership(member, {
                              status: "banned",
                            })
                          }
                        >
                          Ban member
                        </Button>
                      )}

                    {member.status === "banned" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          void updateMembership(member, {
                            status: "active",
                          })
                        }
                      >
                        Restore member
                      </Button>
                    )}

                    {isCreator &&
                      member.role === "member" &&
                      member.status === "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving}
                          onClick={() =>
                            void updateMembership(member, {
                              role: "admin",
                            })
                          }
                        >
                          Promote to admin
                        </Button>
                      )}

                    {isCreator && member.role === "admin" && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={saving}
                        onClick={() =>
                          void updateMembership(member, {
                            role: "member",
                          })
                        }
                      >
                        Remove admin role
                      </Button>
                    )}
                  </div>
                )}
            </div>
          ))
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Club permissions are enforced by Supabase database policies.
        Only the creator can appoint or remove administrators.
      </p>
    </section>
  );
    }
      

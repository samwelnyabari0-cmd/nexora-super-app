
import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type Profile = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

type Activity = {
  id: string;
  actor_user_id: string | null;
  target_user_id: string | null;
  event_type: string;
  details: Record<string, unknown>;
  created_at: string;
};

type Props = {
  clubId: string;
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function ClubAdminPanel({ clubId }: Props) {
  const { user, ready } = useSession();

  const [members, setMembers] = useState<Membership[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adminUserId, setAdminUserId] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const loadMembers = useCallback(async () => {
    if (!user) {
      setMembers([]);
      setProfiles({});
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: queryError } = await (
      supabase.from("club_memberships" as never) as any
    )
      .select("id,user_id,role,status,created_at,appointed_by")
      .eq("club_id", clubId)
      .order("created_at", { ascending: true });

    if (queryError) {
      setError("Unable to load club memberships. Please refresh.");
      setMembers([]);
      setProfiles({});
      setActivities([]);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Membership[];
    setMembers(rows);

    const userIds = [...new Set(rows.map((member) => member.user_id))];

    if (userIds.length) {
      const { data: profileData } = await (
        supabase.from("profiles" as never) as any
      )
        .select("id,display_name,handle,avatar_url")
        .in("id", userIds);

      const profileMap: Record<string, Profile> = {};

      (profileData ?? []).forEach((profile: Profile) => {
        profileMap[profile.id] = profile;
      });

      setProfiles(profileMap);
    } else {
      setProfiles({});
    }

    const { data: activityData, error: activityError } = await (
      supabase.from("club_membership_activity" as never) as any
    )
      .select(
        "id,actor_user_id,target_user_id,event_type,details,created_at"
      )
      .eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!activityError) {
      setActivities((activityData ?? []) as Activity[]);
    } else {
      setActivities([]);
    }

    setLoading(false);
  }, [clubId, user]);

  useEffect(() => {
    if (ready) void loadMembers();
  }, [ready, loadMembers]);

  const currentMembership = members.find(
    (member) => member.user_id === user?.id
  );

  const isCreator = currentMembership?.role === "creator";
  const isAdmin =
    isCreator || currentMembership?.role === "admin";
  const isActive = currentMembership?.status === "active";

  const filteredMembers = useMemo(() => {
    const term = search.trim().toLowerCase();

    return members.filter((member) => {
      const profile = profiles[member.user_id];
      const name = profile?.display_name ?? "";
      const handle = profile?.handle ?? "";

      const matchesSearch =
        !term ||
        name.toLowerCase().includes(term) ||
        handle.toLowerCase().includes(term) ||
        member.user_id.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === "all" || member.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [members, profiles, search, statusFilter]);

  const getMemberName = (id: string | null) => {
    if (!id) return "System";

    const profile = profiles[id];

    if (profile?.display_name) return profile.display_name;
    if (profile?.handle) return `@${profile.handle}`;

    return `Member ${id.slice(0, 8)}`;
  };

  const updateMembership = async (
    member: Membership,
    changes: Partial<Pick<Membership, "role" | "status">>
  ) => {
    if (!isAdmin || !isActive || member.role === "creator") {
      toast.error("You do not have permission to do that.");
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
      toast.error(updateError.message || "Membership update failed.");
      return;
    }

    toast.success("Membership updated.");
    await loadMembers();
  };

  const appointAdmin = async () => {
    if (!isCreator || !isActive || !user) {
      toast.error("Only the active creator can appoint administrators.");
      return;
    }

    const newUserId = adminUserId.trim();

    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        newUserId
      )
    ) {
      toast.error("Enter a valid Supabase Auth user UUID.");
      return;
    }

    if (newUserId === user.id) {
      toast.error("You are already the creator.");
      return;
    }

    const existing = members.find(
      (member) => member.user_id === newUserId
    );

    setSaving(true);

    let actionError: { message: string } | null = null;

    if (existing) {
      if (existing.role === "creator") {
        setSaving(false);
        toast.error("This user is already a creator.");
        return;
      }

      const result = await (
        supabase.from("club_memberships" as never) as any
      )
        .update({ role: "admin", status: "active" })
        .eq("id", existing.id)
        .eq("club_id", clubId);

      actionError = result.error;
    } else {
      const result = await (
        supabase.from("club_memberships" as never) as any
      )
        .insert({
          club_id: clubId,
          user_id: newUserId,
          role: "admin",
          status: "active",
          appointed_by: user.id,
        });

      actionError = result.error;
    }

    setSaving(false);

    if (actionError) {
      toast.error(actionError.message || "Could not appoint administrator.");
      return;
    }

    setAdminUserId("");
    toast.success("Administrator appointed.");
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
        Sign in to access club administration.
      </div>
    );
  }

  return (
    <section className="space-y-5 rounded-2xl border bg-card p-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">Club administration</h2>
          <p className="text-sm text-muted-foreground">
            Membership, roles and club access
          </p>
        </div>

        <span className="rounded-full border px-3 py-1 text-xs font-semibold">
          {isCreator ? "Creator" : isAdmin ? "Administrator" : "Member"}
        </span>
      </div>

      {isCreator && isActive && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-lg">✦</span>
          <div>
            <p className="text-sm font-semibold">Creator-managed club</p>
            <p className="text-xs text-muted-foreground">
              The club has an active registered creator.
            </p>
          </div>
        </div>
      )}

      {!isActive && (
        <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          Your membership is not active. Administration controls are unavailable.
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

      {/* Administrator appointment */}
      {isCreator && isActive && (
        <div className="space-y-3 rounded-xl border p-3">
          <div>
            <h3 className="font-semibold">Appoint an administrator</h3>
            <p className="text-xs text-muted-foreground">
              Enter the person's Supabase Auth user UUID.
            </p>
          </div>

          <input
            value={adminUserId}
            onChange={(event) => setAdminUserId(event.target.value)}
            placeholder="Enter user UUID"
            className="w-full rounded-lg border bg-background px-3 py-3 text-sm"
          />

          <Button
            onClick={() => void appointAdmin()}
            disabled={saving || !adminUserId.trim()}
            className="w-full"
          >
            {saving ? "Saving..." : "Appoint administrator"}
          </Button>
        </div>
      )}

      {/* Member directory */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="font-semibold">Club members</h3>
            <p className="text-xs text-muted-foreground">
              {members.length} membership records
            </p>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => void loadMembers()}
            disabled={loading || saving}
          >
            Refresh
          </Button>
        </div>

        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search names, handles or IDs..."
          className="w-full rounded-lg border bg-background px-3 py-3 text-sm"
        />

        <div className="flex flex-wrap gap-2">
          {["all", "active", "pending", "banned"].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1.5 text-xs capitalize ${
                statusFilter === status
                  ? "border-primary bg-primary/10 text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-4 text-sm text-muted-foreground">
            Loading members...
          </p>
        ) : filteredMembers.length === 0 ? (
          <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">
            No matching members found.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredMembers.map((member) => {
              const profile = profiles[member.user_id];
              const displayName =
                profile?.display_name ||
                (profile?.handle ? `@${profile.handle}` : "Nexora member");

              return (
                <div
                  key={member.id}
                  className="space-y-3 rounded-xl border p-3"
                >
                  <div className="flex items-center gap-3">
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt={displayName}
                        className="h-11 w-11 rounded-full border object-cover"
                      />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-muted text-sm font-bold">
                        {displayName.slice(0, 1).toUpperCase()}
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {displayName}
                      </p>
                      {profile?.handle && (
                        <p className="truncate text-xs text-muted-foreground">
                          @{profile.handle}
                        </p>
                      )}
                      <p className="break-all text-[10px] text-muted-foreground">
                        {member.user_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                      {member.role}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-1 text-xs capitalize">
                      {member.status}
                    </span>
                  </div>

                  {isAdmin && isActive && member.role !== "creator" && (
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

                      {member.status === "active" && (
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
              );
            })}
          </div>
        )}
      </div>

      {/* Activity history */}
      {isAdmin && isActive && (
        <div className="space-y-3 border-t pt-4">
          <div>
            <h3 className="font-semibold">Membership activity</h3>
            <p className="text-xs text-muted-foreground">
              Recent changes recorded by the database
            </p>
          </div>

          {activities.length === 0 ? (
            <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">
              No membership activity recorded yet.
            </p>
          ) : (
            <div className="space-y-3">
              {activities.map((activity) => {
                const details = activity.details ?? {};
                const eventLabel =
                  activity.event_type === "membership_created"
                    ? "Created membership"
                    : activity.event_type === "membership_deleted"
                      ? "Removed membership"
                      : "Updated membership";

                return (
                  <div
                    key={activity.id}
                    className="rounded-lg border p-3"
                  >
                    <p className="text-sm font-medium">{eventLabel}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {getMemberName(activity.actor_user_id)} ·{" "}
                      {activity.target_user_id
                        ? `Target: ${getMemberName(activity.target_user_id)}`
                        : "Club activity"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(activity.created_at)}
                    </p>
                    {typeof details.old_status === "string" &&
                      typeof details.new_status === "string" && (
                        <p className="mt-2 text-xs">
                          Status: {details.old_status} → {details.new_status}
                        </p>
                      )}
                    {typeof details.old_role === "string" &&
                      typeof details.new_role === "string" && (
                        <p className="mt-1 text-xs">
                          Role: {details.old_role} → {details.new_role}
                        </p>
                      )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      <p className="border-t pt-3 text-xs text-muted-foreground">
        Membership permissions are enforced by Supabase. Only the creator
        can appoint or remove administrators.
      </p>
    </section>
  );
                                  }
        

import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Search, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type MemberRow = {
  user_id: string;
  role: "admin" | "member";
  display_name: string;
  handle: string;
  avatar_url: string | null;
};

type DirectoryPerson = {
  id: string;
  display_name: string | null;
  handle: string | null;
  avatar_url: string | null;
};

type GroupMembersDialogProps = {
  groupId: string;
  userId: string;
  onLeave: () => void;
};

export function GroupMembersDialog({
  groupId,
  userId,
  onLeave,
}: GroupMembersDialogProps) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busyUser, setBusyUser] = useState("");
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState("");

  const currentMember = members.find((member) => member.user_id === userId);
  const isAdmin = currentMember?.role === "admin";

  const loadMembers = useCallback(async () => {
    setLoading(true);
    const { data, error: memberError } = await (supabase as any)
      .from("chat_group_members")
      .select("user_id, role")
      .eq("group_id", groupId);

    if (memberError) {
      setError("Could not load group members.");
      setLoading(false);
      return;
    }

    const rows = await Promise.all((data ?? []).map(async (member: any) => {
      const { data: profileData } = await (supabase as any).rpc(
        "get_group_message_sender_profile",
        { p_group_id: groupId, p_user_id: member.user_id },
      );
      const profile = Array.isArray(profileData) ? profileData[0] : profileData;
      return {
        user_id: member.user_id,
        role: member.role,
        display_name: profile?.display_name || "NEXORA User",
        handle: profile?.handle || "",
        avatar_url: profile?.avatar_url || null,
      } as MemberRow;
    }));

    setMembers(rows);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    if (open) void loadMembers();
  }, [open, loadMembers]);

  useEffect(() => {
    if (!open || !isAdmin || query.trim().length < 2) {
      setPeople([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setSearching(true);
      const { data, error: searchError } = await supabase.rpc(
        "search_directory",
        { q: query.trim() },
      );
      if (cancelled) return;
      if (searchError) {
        setPeople([]);
        setError("People search is temporarily unavailable.");
      } else {
        const existing = new Set(members.map((member) => member.user_id));
        setPeople(
          ((data ?? []) as DirectoryPerson[]).filter(
            (person) =>
              person.id !== userId &&
              !existing.has(person.id) &&
              typeof person.handle === "string" &&
              person.handle.trim().length > 0,
          ),
        );
      }
      setSearching(false);
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [open, isAdmin, query, members, userId]);

  async function addMember(person: DirectoryPerson) {
    setBusyUser(person.id);
    setError("");
    const { error: addError } = await (supabase as any)
      .from("chat_group_members")
      .insert({
        group_id: groupId,
        user_id: person.id,
        role: "member",
      });
    if (addError) {
      setError(`Could not add @${person.handle}. They may already be a member.`);
    } else {
      setQuery("");
      setPeople([]);
      await loadMembers();
    }
    setBusyUser("");
  }

  async function removeMember(member: MemberRow) {
    if (!isAdmin || member.user_id === userId) return;
    setBusyUser(member.user_id);
    setError("");
    const { error: removeError } = await (supabase as any)
      .from("chat_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", member.user_id);
    if (removeError) {
      setError(`Could not remove @${member.handle || "member"}.`);
    } else {
      await loadMembers();
    }
    setBusyUser("");
  }

  async function leaveGroup() {
    setLeaving(true);
    setError("");
    const { error: leaveError } = await (supabase as any)
      .from("chat_group_members")
      .delete()
      .eq("group_id", groupId)
      .eq("user_id", userId);
    if (leaveError) {
      setError("Could not leave this group. Please try again.");
      setLeaving(false);
      return;
    }
    setOpen(false);
    onLeave();
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <Users className="h-4 w-4" />
        Members
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="group-members-title"
            className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl border bg-background p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="group-members-title" className="text-lg font-semibold">Group members</h2>
              <Button type="button" variant="ghost" size="icon" aria-label="Close members" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {isAdmin && (
              <div className="mb-4 space-y-2">
                <label htmlFor="add-group-member-search" className="text-sm font-medium">Add people</label>
                <div className="flex items-center gap-2 rounded-lg border px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    id="add-group-member-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name or @handle"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
                  />
                </div>
                {query.trim().length >= 2 && (
                  <div className="max-h-36 overflow-y-auto rounded-lg border p-1">
                    {searching ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">Searching...</p>
                    ) : people.length === 0 ? (
                      <p className="py-3 text-center text-xs text-muted-foreground">No new people found.</p>
                    ) : people.map((person) => (
                      <button
                        type="button"
                        key={person.id}
                        disabled={Boolean(busyUser)}
                        onClick={() => void addMember(person)}
                        className="flex w-full items-center gap-2 rounded-md p-2 text-left hover:bg-muted disabled:opacity-50"
                      >
                        {person.avatar_url ? (
                          <img src={person.avatar_url} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                            {(person.display_name || person.handle || "N").charAt(0).toUpperCase()}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{person.display_name || "NEXORA User"}</span>
                          <span className="block truncate text-xs text-muted-foreground">@{person.handle}</span>
                        </span>
                        {busyUser === person.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-1">
              {loading ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading members...</p>
              ) : members.map((member) => (
                <div key={member.user_id} className="flex items-center gap-3 rounded-lg p-2">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                      {member.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {member.display_name}{member.user_id === userId ? " (You)" : ""}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.handle ? `@${member.handle} · ` : ""}{member.role === "admin" ? "Admin" : "Member"}
                    </p>
                  </div>
                  {isAdmin && member.user_id !== userId && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(busyUser)}
                      onClick={() => void removeMember(member)}
                    >
                      {busyUser === member.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Remove"}
                    </Button>
                  )}
                </div>
              ))}
            </div>

            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}

            <Button type="button" variant="destructive" className="mt-5 w-full" disabled={leaving} onClick={() => void leaveGroup()}>
              {leaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Leaving...</> : "Leave group"}
            </Button>
          </section>
        </div>
      )}
    </>
  );
}

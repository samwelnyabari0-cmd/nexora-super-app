import { useEffect, useState, type FormEvent } from "react";
import { Check, ImagePlus, Loader2, Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

type DirectoryPerson = {
  id: string;
  display_name: string | null;
  handle: string | null;
};

type CreateGroupDialogProps = {
  userId: string;
  onCreated: (groupId: string) => void;
};

export function CreateGroupDialog({
  userId,
  onCreated,
}: CreateGroupDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [people, setPeople] = useState<DirectoryPerson[]>([]);
  const [selected, setSelected] = useState<DirectoryPerson[]>([]);
  const [photo, setPhoto] = useState<File | null>(null);
  const [searching, setSearching] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || query.trim().length < 2) {
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
        setPeople(
          ((data ?? []) as DirectoryPerson[]).filter(
            (person) =>
              person.id !== userId &&
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
  }, [open, query, userId]);

  function reset() {
    setName("");
    setDescription("");
    setQuery("");
    setPeople([]);
    setSelected([]);
    setPhoto(null);
    setError("");
  }

  function togglePerson(person: DirectoryPerson) {
    setSelected((current) =>
      current.some((item) => item.id === person.id)
        ? current.filter((item) => item.id !== person.id)
        : [...current, person],
    );
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const groupName = name.trim();
    if (!groupName || creating) return;

    setCreating(true);
    setError("");

    const { data: group, error: groupError } = await (supabase as any)
      .from("chat_groups")
      .insert({
        name: groupName,
        description: description.trim() || null,
        created_by: userId,
      })
      .select("id")
      .single();

    if (groupError || !group?.id) {
      setError("Could not create the group. Please try again.");
      setCreating(false);
      return;
    }

    const groupId = group.id as string;
    const warnings: string[] = [];

    if (photo) {
      const extension = photo.name.split(".").pop()?.toLowerCase() || "jpg";
      const photoPath = `groups/${groupId}/${userId}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from("chat-media")
        .upload(photoPath, photo, {
          contentType: photo.type,
          upsert: false,
        });

      if (uploadError) {
        warnings.push("The group was created, but its photo could not be uploaded.");
      } else {
        const { error: updateError } = await (supabase as any)
          .from("chat_groups")
          .update({ avatar_url: photoPath })
          .eq("id", groupId);
        if (updateError) {
          warnings.push("The group was created, but its photo could not be saved.");
        }
      }
    }

    const failedMembers: string[] = [];
    if (selected.length > 0) {
      const results = await Promise.all(
        selected.map(async (person) => {
          const { error: memberError } = await (supabase as any)
            .from("chat_group_members")
            .insert({
              group_id: groupId,
              user_id: person.id,
              role: "member",
            });
          return { handle: person.handle || person.display_name || "selected user", failed: Boolean(memberError) };
        }),
      );
      failedMembers.push(...results.filter((result) => result.failed).map((result) => result.handle));
    }

    setCreating(false);
    if (warnings.length > 0 || failedMembers.length > 0) {
      const messages = [...warnings];
      if (failedMembers.length > 0) {
        messages.push(`Could not add: ${failedMembers.map((handle) => "@" + handle).join(", ")}. You can add them later from group members.`);
      }
      window.alert(messages.join("\\n"));
    }
    setOpen(false);
    reset();
    onCreated(groupId);
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} className="gap-2">
        <Plus className="h-4 w-4" />
        Create group
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setOpen(false);
              reset();
            }
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-group-title"
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border bg-background p-5 shadow-xl sm:rounded-2xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="create-group-title" className="text-lg font-semibold">
                Create a group
              </h2>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Close"
                disabled={creating}
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <form onSubmit={createGroup} className="space-y-4">
              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Group name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  maxLength={80}
                  placeholder="e.g. Campus friends"
                  className="w-full rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="block space-y-1.5 text-sm">
                <span className="font-medium">Description (optional)</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="What is this group about?"
                  className="w-full resize-none rounded-lg border bg-background px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary"
                />
              </label>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm hover:bg-muted/50">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <ImagePlus className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Group photo (optional)</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {photo ? photo.name : "Choose an image up to 5 MB"}
                  </span>
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (file && (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024)) {
                      setError("Choose an image no larger than 5 MB.");
                      setPhoto(null);
                      return;
                    }
                    setError("");
                    setPhoto(file);
                  }}
                />
              </label>

              <div className="space-y-2">
                <label className="block text-sm font-medium" htmlFor="group-member-search">
                  Add people
                </label>
                <div className="flex items-center gap-2 rounded-lg border px-3">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <input
                    id="group-member-search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search by name or @handle"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
                  />
                </div>

                {selected.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {selected.map((person) => (
                      <button
                        type="button"
                        key={person.id}
                        onClick={() => togglePerson(person)}
                        className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1.5 text-xs"
                      >
                        @{person.handle}
                        <X className="h-3 w-3" />
                      </button>
                    ))}
                  </div>
                )}

                <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border p-2">
                  {searching ? (
                    <p className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Searching...
                    </p>
                  ) : query.trim().length < 2 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Enter at least 2 characters to find people.
                    </p>
                  ) : people.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      No discoverable people found.
                    </p>
                  ) : (
                    people.map((person) => {
                      const isSelected = selected.some((item) => item.id === person.id);
                      return (
                        <button
                          type="button"
                          key={person.id}
                          onClick={() => togglePerson(person)}
                          className="flex w-full items-center gap-3 rounded-md p-2 text-left hover:bg-muted"
                        >
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold">
                            {(person.display_name || person.handle || "N").charAt(0).toUpperCase()}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {person.display_name || "NEXORA User"}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">
                              @{person.handle}
                            </span>
                          </span>
                          {isSelected && <Check className="h-4 w-4 text-primary" />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

              <Button type="submit" className="w-full" disabled={!name.trim() || creating}>
                {creating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Creating...</>
                ) : (
                  "Create group"
                )}
              </Button>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

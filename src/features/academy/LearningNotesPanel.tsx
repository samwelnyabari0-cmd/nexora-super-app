import { useCallback, useEffect, useId, useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createLearningNote,
  deleteLearningNote,
  listLearningNotes,
  MAX_LEARNING_NOTE_BODY_LENGTH,
  MAX_LEARNING_NOTE_TITLE_LENGTH,
  updateLearningNote,
  type LearningNote,
} from "./learningNotes";

type LearningNotesPanelProps = {
  courseId: string;
  lessonId: string | null;
  isSignedIn: boolean;
  canUseNotes: boolean;
};

export function LearningNotesPanel({
  courseId,
  lessonId,
  isSignedIn,
  canUseNotes,
}: LearningNotesPanelProps) {
  const titleInputId = useId();
  const bodyInputId = useId();
  const [notes, setNotes] = useState<LearningNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loadNotes = useCallback(async () => {
    if (!canUseNotes) {
      setNotes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const result = await listLearningNotes(courseId, lessonId);
    setNotes(result.data);
    setError(result.error?.message ?? null);
    setLoading(false);
  }, [canUseNotes, courseId, lessonId]);

  useEffect(() => {
    setTitle("");
    setBody("");
    setEditingNoteId(null);
    setConfirmDeleteId(null);
    void loadNotes();
  }, [loadNotes]);

  function startEditing(note: LearningNote) {
    setEditingNoteId(note.id);
    setTitle(note.title);
    setBody(note.body);
    setError(null);
    setConfirmDeleteId(null);
  }

  function cancelEditing() {
    setEditingNoteId(null);
    setTitle("");
    setBody("");
    setError(null);
  }

  async function handleSave() {
    if (!canUseNotes || saving) return;

    setSaving(true);
    setError(null);
    const result = editingNoteId
      ? await updateLearningNote(editingNoteId, { title, body })
      : await createLearningNote({ courseId, lessonId, title, body });

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    toast.success(editingNoteId ? "Note updated." : "Note saved.");
    setEditingNoteId(null);
    setTitle("");
    setBody("");
    await loadNotes();
    setSaving(false);
  }

  async function handleDelete(noteId: string) {
    if (!canUseNotes || deletingNoteId) return;

    setDeletingNoteId(noteId);
    setError(null);
    const result = await deleteLearningNote(noteId);

    if (result.error) {
      setError(result.error.message);
      setDeletingNoteId(null);
      return;
    }

    setConfirmDeleteId(null);
    if (editingNoteId === noteId) cancelEditing();
    toast.success("Note deleted.");
    await loadNotes();
    setDeletingNoteId(null);
  }

  const titleLength = Array.from(title).length;
  const bodyLength = Array.from(body).length;
  const heading = lessonId ? "My lesson notes" : "My course notes";

  return (
    <section className="rounded-2xl border bg-card p-4" aria-labelledby={`learning-notes-heading-${titleInputId}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 id={`learning-notes-heading-${titleInputId}`} className="font-semibold">{heading}</h3>
          <p className="mt-1 text-xs text-muted-foreground">Private notes visible only to you</p>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
      </div>

      {!canUseNotes ? (
        <p className="mt-4 rounded-xl bg-muted p-3 text-sm text-muted-foreground">
          {isSignedIn
            ? "Enrol in this course to create and view your private notes."
            : "Sign in and enrol in this course to create private notes."}
        </p>
      ) : (
        <>
          <div className="mt-4 space-y-3">
            <div>
              <label htmlFor={titleInputId} className="mb-1 block text-sm font-medium">Note title</label>
              <input
                id={titleInputId}
                value={title}
                maxLength={MAX_LEARNING_NOTE_TITLE_LENGTH * 2}
                onChange={(event) => { if (Array.from(event.target.value).length <= MAX_LEARNING_NOTE_TITLE_LENGTH) setTitle(event.target.value); }}
                placeholder="Give this note a title"
                className="w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{titleLength}/{MAX_LEARNING_NOTE_TITLE_LENGTH}</p>
            </div>
            <div>
              <label htmlFor={bodyInputId} className="mb-1 block text-sm font-medium">Note text</label>
              <textarea
                id={bodyInputId}
                value={body}
                maxLength={MAX_LEARNING_NOTE_BODY_LENGTH * 2}
                onChange={(event) => { if (Array.from(event.target.value).length <= MAX_LEARNING_NOTE_BODY_LENGTH) setBody(event.target.value); }}
                rows={4}
                placeholder="Write something you want to remember…"
                className="w-full resize-y rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              <p className="mt-1 text-right text-xs text-muted-foreground">{bodyLength}/{MAX_LEARNING_NOTE_BODY_LENGTH}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button type="button" size="sm" disabled={saving || !title.trim() || !body.trim()} onClick={() => void handleSave()}>
                {saving ? "Saving…" : editingNoteId ? "Update note" : "Save note"}
              </Button>
              {editingNoteId && (
                <Button type="button" size="sm" variant="outline" disabled={saving} onClick={cancelEditing}>
                  <X className="mr-1 h-4 w-4" /> Cancel edit
                </Button>
              )}
            </div>
          </div>

          {error && <p className="mt-3 text-sm text-destructive" role="alert">{error}</p>}

          <div className="mt-5 space-y-3">
            {loading ? (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Loading your notes…</p>
            ) : notes.length === 0 ? (
              <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">No notes yet. Add your first note above.</p>
            ) : notes.map((note) => (
              <article key={note.id} className="rounded-xl border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="break-words font-medium">{note.title}</h4>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{note.body}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Updated {new Date(note.updatedAt).toLocaleString()}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" aria-label={`Edit ${note.title}`} onClick={() => startEditing(note)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" aria-label={`Delete ${note.title}`} onClick={() => setConfirmDeleteId(note.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {confirmDeleteId === note.id && (
                  <div className="mt-3 rounded-lg bg-muted p-3" role="group" aria-label={`Confirm delete ${note.title}`}>
                    <p className="text-sm">Delete this note? This cannot be undone.</p>
                    <div className="mt-2 flex gap-2">
                      <Button type="button" size="sm" variant="destructive" disabled={deletingNoteId === note.id} onClick={() => void handleDelete(note.id)}>
                        {deletingNoteId === note.id ? "Deleting…" : "Confirm delete"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" disabled={deletingNoteId === note.id} onClick={() => setConfirmDeleteId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
    </section>
  );
}

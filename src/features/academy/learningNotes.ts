import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export const MAX_LEARNING_NOTE_TITLE_LENGTH = 100;
export const MAX_LEARNING_NOTE_BODY_LENGTH = 5000;

export type LearningNote = {
  id: string;
  courseId: string;
  lessonId: string | null;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

export type LearningNoteDraft = {
  courseId: string;
  lessonId?: string | null;
  title: string;
  body: string;
};

type LearningNoteRow = Tables<"edu_learning_notes">;

function toError(error: { message: string } | null): Error | null {
  return error ? new Error(error.message) : null;
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

export function validateLearningNoteDraft(
  draft: Pick<LearningNoteDraft, "title" | "body">,
): string | null {
  if (!draft.title.trim()) return "Add a title for this note.";
  if (characterLength(draft.title) > MAX_LEARNING_NOTE_TITLE_LENGTH) {
    return "Title must be 100 characters or fewer.";
  }
  if (!draft.body.trim()) return "Write something in your note.";
  if (characterLength(draft.body) > MAX_LEARNING_NOTE_BODY_LENGTH) {
    return "Note must be 5,000 characters or fewer.";
  }
  return null;
}

export function mapLearningNote(row: LearningNoteRow): LearningNote {
  return {
    id: row.id,
    courseId: row.course_id,
    lessonId: row.lesson_id,
    title: row.title,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getCurrentStudentId(): Promise<{ studentId: string | null; error: Error | null }> {
  const { data, error } = await supabase.auth.getUser();
  if (error) return { studentId: null, error: toError(error) };
  if (!data.user) {
    return {
      studentId: null,
      error: new Error("Sign in to use your learning notes."),
    };
  }
  return { studentId: data.user.id, error: null };
}

export async function listLearningNotes(
  courseId: string,
  lessonId: string | null = null,
): Promise<{ data: LearningNote[]; error: Error | null }> {
  const baseQuery = supabase
    .from("edu_learning_notes")
    .select("id, student_id, course_id, lesson_id, title, body, created_at, updated_at")
    .eq("course_id", courseId);

  const scopedQuery = lessonId
    ? baseQuery.eq("lesson_id", lessonId)
    : baseQuery.is("lesson_id", null);

  const { data, error } = await scopedQuery.order("updated_at", { ascending: false });
  if (error) return { data: [], error: toError(error) };
  return { data: (data ?? []).map(mapLearningNote), error: null };
}

export async function createLearningNote(
  input: LearningNoteDraft,
): Promise<{ data: LearningNote | null; error: Error | null }> {
  const validationError = validateLearningNoteDraft(input);
  if (validationError) return { data: null, error: new Error(validationError) };

  const { studentId, error: authError } = await getCurrentStudentId();
  if (authError || !studentId) return { data: null, error: authError };

  const { data, error } = await supabase
    .from("edu_learning_notes")
    .insert({
      student_id: studentId,
      course_id: input.courseId,
      lesson_id: input.lessonId ?? null,
      title: input.title.trim(),
      body: input.body.trim(),
    })
    .select("id, student_id, course_id, lesson_id, title, body, created_at, updated_at")
    .single();

  if (error) return { data: null, error: toError(error) };
  return { data: mapLearningNote(data), error: null };
}

export async function updateLearningNote(
  noteId: string,
  input: Pick<LearningNoteDraft, "title" | "body">,
): Promise<{ error: Error | null }> {
  const validationError = validateLearningNoteDraft(input);
  if (validationError) return { error: new Error(validationError) };

  const { data, error } = await supabase
    .from("edu_learning_notes")
    .update({ title: input.title.trim(), body: input.body.trim() })
    .eq("id", noteId)
    .select("id")
    .maybeSingle();

  if (error) return { error: toError(error) };
  return data ? { error: null } : { error: new Error("Note not found or no longer accessible.") };
}

export async function deleteLearningNote(noteId: string): Promise<{ error: Error | null }> {
  const { data, error } = await supabase
    .from("edu_learning_notes")
    .delete()
    .eq("id", noteId)
    .select("id")
    .maybeSingle();

  if (error) return { error: toError(error) };
  return data ? { error: null } : { error: new Error("Note not found or no longer accessible.") };
}

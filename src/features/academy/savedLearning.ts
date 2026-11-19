import { supabase } from "@/integrations/supabase/client";

export type SavedItemType = "course" | "lesson" | "resource" | "educator";
export type SavedItemFilter = "all" | SavedItemType;

export type SavedLearningItem = {
  id: string;
  user_id: string;
  item_type: SavedItemType;
  course_id: string | null;
  lesson_id: string | null;
  resource_id: string | null;
  educator_id: string | null;
  saved_at: string;
};

export type SavedLearningInsert = {
  user_id: string;
  item_type: SavedItemType;
  course_id: string | null;
  lesson_id: string | null;
  resource_id: string | null;
  educator_id: string | null;
};

const referenceColumn: Record<SavedItemType, "course_id" | "lesson_id" | "resource_id" | "educator_id"> = {
  course: "course_id",
  lesson: "lesson_id",
  resource: "resource_id",
  educator: "educator_id",
};

const conflictColumns = "user_id,item_type,course_id,lesson_id,resource_id,educator_id";

export function buildSavedLearningInsert(
  userId: string,
  itemType: SavedItemType,
  itemId: string,
): SavedLearningInsert {
  return {
    user_id: userId,
    item_type: itemType,
    course_id: itemType === "course" ? itemId : null,
    lesson_id: itemType === "lesson" ? itemId : null,
    resource_id: itemType === "resource" ? itemId : null,
    educator_id: itemType === "educator" ? itemId : null,
  };
}

export function filterSavedLearningItems<T extends { item_type: SavedItemType }>(
  items: T[],
  filter: SavedItemFilter,
): T[] {
  return filter === "all" ? items : items.filter((item) => item.item_type === filter);
}

export async function listSavedLearningItems(userId: string) {
  return (supabase as any)
    .from("edu_saved_items")
    .select("id, user_id, item_type, course_id, lesson_id, resource_id, educator_id, saved_at")
    .eq("user_id", userId)
    .order("saved_at", { ascending: false });
}

export async function saveLearningItem(
  userId: string,
  itemType: SavedItemType,
  itemId: string,
) {
  const row = buildSavedLearningInsert(userId, itemType, itemId);
  return (supabase as any)
    .from("edu_saved_items")
    .upsert(row, { onConflict: conflictColumns, ignoreDuplicates: true });
}

export async function unsaveLearningItem(
  userId: string,
  itemType: SavedItemType,
  itemId: string,
) {
  return (supabase as any)
    .from("edu_saved_items")
    .delete()
    .eq("user_id", userId)
    .eq("item_type", itemType)
    .eq(referenceColumn[itemType], itemId);
}

export async function importLegacySavedCourses(userId: string, courseIds: string[]) {
  const uniqueIds = [...new Set(courseIds.filter((id) => typeof id === "string" && id.trim()))];
  if (uniqueIds.length === 0) return { error: null, imported: 0 };

  const rows = uniqueIds.map((id) => buildSavedLearningInsert(userId, "course", id));
  const { error } = await (supabase as any)
    .from("edu_saved_items")
    .upsert(rows, { onConflict: conflictColumns, ignoreDuplicates: true });

  return { error, imported: error ? 0 : uniqueIds.length };
}

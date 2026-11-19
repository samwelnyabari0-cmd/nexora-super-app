import { beforeEach, describe, expect, it, vi } from "vitest";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSavedLearningInsert,
  filterSavedLearningItems,
  importLegacySavedCourses,
  saveLearningItem,
  unsaveLearningItem,
  type SavedLearningItem,
} from "./savedLearning";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

const savedItems = [
  { item_type: "course" },
  { item_type: "lesson" },
  { item_type: "resource" },
  { item_type: "educator" },
] as SavedLearningItem[];

describe("buildSavedLearningInsert", () => {
  it.each(["course", "lesson", "resource", "educator"] as const)(
    "sets only the matching reference for %s",
    (itemType) => {
      const row = buildSavedLearningInsert("user-1", itemType, "item-1");
      expect(row.user_id).toBe("user-1");
      expect(row.item_type).toBe(itemType);
      const refs = [row.course_id, row.lesson_id, row.resource_id, row.educator_id];
      expect(refs.filter(Boolean)).toEqual(["item-1"]);
    },
  );
});

describe("filterSavedLearningItems", () => {
  it("returns all four item kinds for All Saved", () => {
    expect(filterSavedLearningItems(savedItems, "all")).toHaveLength(4);
  });

  it.each(["course", "lesson", "resource", "educator"] as const)(
    "filters only %s items",
    (itemType) => {
      expect(filterSavedLearningItems(savedItems, itemType)).toEqual([
        { item_type: itemType },
      ]);
    },
  );
});

describe("saved learning mutations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("uses an idempotent upsert for duplicate saves", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({ upsert });

    await saveLearningItem("user-1", "lesson", "lesson-1");

    expect(upsert).toHaveBeenCalledWith(
      {
        user_id: "user-1",
        item_type: "lesson",
        course_id: null,
        lesson_id: "lesson-1",
        resource_id: null,
        educator_id: null,
      },
      {
        onConflict: "user_id,item_type,course_id,lesson_id,resource_id,educator_id",
        ignoreDuplicates: true,
      },
    );
  });

  it("deletes only the current user's selected item", async () => {
    const eq = vi.fn().mockReturnThis();
    const remove = vi.fn().mockReturnValue({ eq });
    (supabase as any).from.mockReturnValue({ delete: remove });

    await unsaveLearningItem("user-1", "educator", "educator-1");

    expect(supabase.from).toHaveBeenCalledWith("edu_saved_items");
    expect(eq).toHaveBeenNthCalledWith(1, "user_id", "user-1");
    expect(eq).toHaveBeenNthCalledWith(2, "item_type", "educator");
    expect(eq).toHaveBeenNthCalledWith(3, "educator_id", "educator-1");
  });

  it("imports legacy courses idempotently and keeps errors visible to the caller", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    (supabase as any).from.mockReturnValue({ upsert });

    const result = await importLegacySavedCourses("user-1", ["course-1", "course-1", "course-2"]);

    expect(result).toEqual({ error: null, imported: 2 });
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0]).toHaveLength(2);
  });

  it("does not report an import as successful when the database rejects it", async () => {
    const error = { message: "insert denied" };
    const upsert = vi.fn().mockResolvedValue({ error });
    (supabase as any).from.mockReturnValue({ upsert });

    const result = await importLegacySavedCourses("user-1", ["course-1"]);

    expect(result).toEqual({ error, imported: 0 });
  });
});

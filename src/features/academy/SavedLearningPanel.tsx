import { useEffect, useMemo, useState } from "react";
import { Bookmark, BookOpen, FileArchive, GraduationCap, Trash2, UserRound, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import {
  listSavedLearningItems,
  importLegacySavedCourses,
  unsaveLearningItem,
  type SavedItemFilter,
  type SavedItemType,
  type SavedLearningItem,
} from "./savedLearning";

type SavedDisplayItem = {
  key: string;
  itemType: SavedItemType;
  itemId: string;
  title: string;
  description: string;
  detail: string;
  courseId?: string;
  thumbnailUrl?: string | null;
};

const filters: { id: SavedItemFilter; label: string }[] = [
  { id: "all", label: "All Saved" },
  { id: "course", label: "Courses" },
  { id: "lesson", label: "Lessons" },
  { id: "resource", label: "Resources" },
  { id: "educator", label: "Educators" },
];

const itemIcons = {
  course: BookOpen,
  lesson: Video,
  resource: FileArchive,
  educator: GraduationCap,
};

export function SavedLearningPanel({
  onOpenCourse,
  onOpenEducator,
  onLegacyImported,
}: {
  onOpenCourse: (courseId: string) => void;
  onOpenEducator: (educatorId: string) => void;
  onLegacyImported: () => void;
}) {
  const { user } = useSession();
  const [items, setItems] = useState<SavedDisplayItem[]>([]);
  const [filter, setFilter] = useState<SavedItemFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const legacyIds = (() => {
          try {
            const parsed = JSON.parse(localStorage.getItem("nexora-academy-saved-courses") ?? "[]");
            return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
          } catch {
            return [];
          }
        })();

        if (legacyIds.length > 0) {
          const imported = await importLegacySavedCourses(user.id, legacyIds);
          if (imported.error) {
            throw new Error(imported.error.message || "Could not import your saved courses.");
          }
          localStorage.removeItem("nexora-academy-saved-courses");
          onLegacyImported();
        }

        const { data: rows, error: listError } = await listSavedLearningItems(user.id);
        if (listError) throw listError;
        const savedRows = (Array.isArray(rows) ? rows : []) as SavedLearningItem[];
        const courseIds = savedRows.flatMap((item) => item.course_id ? [item.course_id] : []);
        const lessonIds = savedRows.flatMap((item) => item.lesson_id ? [item.lesson_id] : []);
        const resourceIds = savedRows.flatMap((item) => item.resource_id ? [item.resource_id] : []);
        const educatorIds = savedRows.flatMap((item) => item.educator_id ? [item.educator_id] : []);

        const [courseResult, lessonResult, resourceResult, ...educatorResults] = await Promise.all([
          courseIds.length
            ? (supabase as any).from("edu_courses")
                .select("id, title, description, category, level, thumbnail_url, is_published")
                .in("id", courseIds)
                .eq("is_published", true)
            : Promise.resolve({ data: [], error: null }),
          lessonIds.length
            ? (supabase as any).from("edu_lessons")
                .select("id, title, description, course_id, lesson_order, duration_seconds")
                .in("id", lessonIds)
            : Promise.resolve({ data: [], error: null }),
          resourceIds.length
            ? (supabase as any).from("edu_resources")
                .select("id, resource_name, file_type, course_id, access_tier")
                .in("id", resourceIds)
            : Promise.resolve({ data: [], error: null }),
          ...educatorIds.map((id) => (supabase as any).rpc("get_academy_educator", { p_educator_id: id })),
        ]);

        if (courseResult.error) throw courseResult.error;
        if (lessonResult.error) throw lessonResult.error;
        if (resourceResult.error) throw resourceResult.error;

        const courses = new Map((courseResult.data ?? []).map((item: any) => [item.id, item]));
        const lessons = new Map((lessonResult.data ?? []).map((item: any) => [item.id, item]));
        const resources = new Map((resourceResult.data ?? []).map((item: any) => [item.id, item]));
        const educators = new Map<string, any>();
        educatorResults.forEach((result: any) => {
          const educator = result.data?.[0];
          if (educator) educators.set(educator.id, educator);
        });

        const displayItems: SavedDisplayItem[] = [];
        for (const saved of savedRows) {
          if (saved.item_type === "course" && saved.course_id) {
            const course: any = courses.get(saved.course_id);
            if (course) displayItems.push({
              key: saved.id, itemType: "course", itemId: course.id,
              title: course.title, description: course.description ?? "",
              detail: course.category + " · " + course.level,
              courseId: course.id, thumbnailUrl: course.thumbnail_url,
            });
          } else if (saved.item_type === "lesson" && saved.lesson_id) {
            const lesson: any = lessons.get(saved.lesson_id);
            if (lesson) displayItems.push({
              key: saved.id, itemType: "lesson", itemId: lesson.id,
              title: lesson.title, description: lesson.description ?? "",
              detail: "Lesson " + lesson.lesson_order,
              courseId: lesson.course_id,
            });
          } else if (saved.item_type === "resource" && saved.resource_id) {
            const resource: any = resources.get(saved.resource_id);
            if (resource) displayItems.push({
              key: saved.id, itemType: "resource", itemId: resource.id,
              title: resource.resource_name, description: "",
              detail: resource.file_type + " · " + resource.access_tier,
              courseId: resource.course_id,
            });
          } else if (saved.item_type === "educator" && saved.educator_id) {
            const educator: any = educators.get(saved.educator_id);
            if (educator) displayItems.push({
              key: saved.id, itemType: "educator", itemId: educator.id,
              title: educator.display_name || educator.handle || "Education creator",
              description: educator.bio ?? "",
              detail: educator.account_type === "business" ? "Business · Education" : "Creator · Education",
            });
          }
        }

        if (active) setItems(displayItems);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Could not load saved learning.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [user?.id, onLegacyImported]);

  const visibleItems = useMemo(
    () => filter === "all" ? items : items.filter((item) => item.itemType === filter),
    [items, filter],
  );

  async function removeItem(item: SavedDisplayItem) {
    if (!user) return;
    setRemoving(item.key);
    const { error: removeError } = await unsaveLearningItem(user.id, item.itemType, item.itemId);
    if (removeError) {
      setError(removeError.message || "Could not remove this saved item.");
    } else {
      setItems((current) => current.filter((saved) => saved.key !== item.key));
    }
    setRemoving(null);
  }

  if (!user) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center">
        <Bookmark className="mx-auto h-7 w-7 text-muted-foreground" />
        <p className="mt-3 font-semibold">Your saved learning</p>
        <p className="mt-1 text-sm text-muted-foreground">Sign in to sync saved courses, lessons, resources and educators across devices. Your saved courses on this device remain available in the course catalog.</p>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-label="Saved learning items">
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <button type="button" key={item.id} aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${filter === item.id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">Loading your saved learning…</div>
      ) : error ? (
        <div role="alert" className="rounded-2xl border border-destructive/40 p-5 text-sm text-destructive">{error}</div>
      ) : visibleItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-7 text-center">
          <Bookmark className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing saved here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Save courses, lessons, resources or educators to find them here.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {visibleItems.map((item) => {
            const Icon = itemIcons[item.itemType];
            return (
              <article key={item.key} className="flex min-w-0 items-start gap-3 rounded-2xl border bg-background p-3">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt="" className="h-14 w-14 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description || item.detail}</p>
                  <p className="mt-1 text-[11px] capitalize text-muted-foreground">{item.itemType} · {item.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" onClick={() => item.itemType === "educator" ? onOpenEducator(item.itemId) : item.courseId && onOpenCourse(item.courseId)}>
                      {item.itemType === "educator" ? "View educator" : "Open course"}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={removing === item.key} onClick={() => void removeItem(item)} aria-label={"Remove saved " + item.itemType}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

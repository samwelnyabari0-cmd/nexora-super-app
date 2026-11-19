import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive, BookOpen, Clock3, FileArchive, GraduationCap, Loader2,
  MoreHorizontal, RefreshCw, Video, X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getContentDeletionEligibility, type PublicationStatus } from "./creatorContent";

type CourseRow = {
  id: string;
  title: string;
  description: string;
  category: string;
  is_published: boolean;
  publication_status: PublicationStatus;
  published_at: string | null;
  last_published_at: string | null;
  skill_tags: string[];
  created_at: string;
  updated_at: string;
};

type LessonRow = {
  id: string;
  course_id: string;
  title: string;
  lesson_order: number;
  publication_status: PublicationStatus;
  published_at: string | null;
};

type ResourceRow = {
  id: string;
  course_id: string;
  resource_name: string;
  file_type: string;
  file_size_bytes: number;
  publication_status: PublicationStatus;
  published_at: string | null;
};

type CourseSummary = CourseRow & {
  lessonCount: number;
  resourceCount: number;
  learnerCount: number;
};

type ManagerTab = "courses" | "lessons" | "resources";
type StatusFilter = "all" | PublicationStatus;

const statusLabel: Record<PublicationStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

function formatDate(value: string | null) {
  if (!value) return "Not currently published";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}

function formatBytes(value: number) {
  if (!value) return "File size unavailable";
  if (value < 1024 * 1024) return `${Math.max(1, Math.round(value / 1024))} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function CreatorContentManager() {
  const [courses, setCourses] = useState<CourseSummary[]>([]);
  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [resources, setResources] = useState<ResourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<ManagerTab>("courses");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [deleteCourse, setDeleteCourse] = useState<CourseSummary | null>(null);
  const [confirmation, setConfirmation] = useState("");

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const { data: courseRows, error: courseError } = await (supabase as any)
        .from("edu_courses")
        .select("id,title,description,category,is_published,publication_status,published_at,last_published_at,skill_tags,created_at,updated_at")
        .order("updated_at", { ascending: false });
      if (courseError) throw courseError;

      const ownedCourses = (Array.isArray(courseRows) ? courseRows : []) as CourseRow[];
      const ids = ownedCourses.map((course) => course.id);
      if (!ids.length) {
        setCourses([]);
        setLessons([]);
        setResources([]);
        return;
      }

      const [lessonResult, resourceResult, enrollmentResult] = await Promise.all([
        (supabase as any).from("edu_lessons")
          .select("id,course_id,title,lesson_order,publication_status,published_at")
          .in("course_id", ids)
          .order("lesson_order", { ascending: true }),
        (supabase as any).from("edu_resources")
          .select("id,course_id,resource_name,file_type,file_size_bytes,publication_status,published_at")
          .in("course_id", ids)
          .order("created_at", { ascending: false }),
        (supabase as any).from("edu_enrollments")
          .select("course_id,student_id,status")
          .in("course_id", ids)
          .in("status", ["active", "completed"]),
      ]);

      if (lessonResult.error) throw lessonResult.error;
      if (resourceResult.error) throw resourceResult.error;
      if (enrollmentResult.error) throw enrollmentResult.error;

      const lessonRows = (Array.isArray(lessonResult.data) ? lessonResult.data : []) as LessonRow[];
      const resourceRows = (Array.isArray(resourceResult.data) ? resourceResult.data : []) as ResourceRow[];
      const enrollmentRows = Array.isArray(enrollmentResult.data) ? enrollmentResult.data : [];

      setLessons(lessonRows);
      setResources(resourceRows);
      setCourses(ownedCourses.map((course) => ({
        ...course,
        lessonCount: lessonRows.filter((lesson) => lesson.course_id === course.id).length,
        resourceCount: resourceRows.filter((resource) => resource.course_id === course.id).length,
        learnerCount: new Set(
          enrollmentRows
            .filter((enrollment: { course_id: string; student_id: string }) => enrollment.course_id === course.id)
            .map((enrollment: { student_id: string }) => enrollment.student_id),
        ).size,
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load your Academy content.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadContent(); }, [loadContent]);

  const visibleCourses = useMemo(
    () => courses.filter((course) => filter === "all" || course.publication_status === filter),
    [courses, filter],
  );
  const courseNames = useMemo(
    () => new Map(courses.map((course) => [course.id, course.title])),
    [courses],
  );
  const visibleLessons = useMemo(
    () => lessons.filter((lesson) => filter === "all" || lesson.publication_status === filter),
    [lessons, filter],
  );
  const visibleResources = useMemo(
    () => resources.filter((resource) => filter === "all" || resource.publication_status === filter),
    [resources, filter],
  );

  async function setCourseStatus(course: CourseSummary, nextStatus: PublicationStatus) {
    setBusyId(course.id);
    try {
      const update = nextStatus === "published"
        ? { publication_status: "published", is_published: true }
        : { publication_status: nextStatus, is_published: false };
      const { error } = await (supabase as any).from("edu_courses")
        .update(update).eq("id", course.id);
      if (error) throw error;
      toast.success(nextStatus === "published" ? "Course published." : nextStatus === "archived" ? "Course archived." : "Course unpublished.");
      await loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update this course.");
    } finally {
      setBusyId(null);
    }
  }

  async function permanentlyDeleteCourse() {
    if (!deleteCourse || confirmation !== deleteCourse.title) return;
    setBusyId(deleteCourse.id);
    try {
      const { data, error } = await (supabase as any).rpc("delete_academy_course", {
        p_course_id: deleteCourse.id,
        p_confirmation_title: confirmation,
      });
      if (error) throw error;
      toast.success(`Course deleted. ${Number(data) || 0} active or completed learners were affected.`);
      setDeleteCourse(null);
      setConfirmation("");
      await loadContent();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Course deletion failed.");
    } finally {
      setBusyId(null);
    }
  }

  const tabs: { id: ManagerTab; label: string; count: number; icon: typeof BookOpen }[] = [
    { id: "courses", label: "Courses", count: courses.length, icon: BookOpen },
    { id: "lessons", label: "Lessons", count: lessons.length, icon: Video },
    { id: "resources", label: "Resources", count: resources.length, icon: FileArchive },
  ];

  return (
    <section className="space-y-5" aria-label="My Academy content manager">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Creator Studio</p>
          <h2 className="mt-1 text-2xl font-bold">My Content Manager</h2>
          <p className="mt-1 text-sm text-muted-foreground">Manage your courses, lessons and learning resources in one place.</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadContent()} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryTile icon={BookOpen} label="Courses" value={courses.length} />
        <SummaryTile icon={Video} label="Lessons" value={lessons.length} />
        <SummaryTile icon={GraduationCap} label="Learners" value={courses.reduce((sum, course) => sum + course.learnerCount, 0)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Content type">
          {tabs.map(({ id, label, count, icon: Icon }) => (
            <Button key={id} type="button" size="sm" variant={tab === id ? "default" : "outline"} onClick={() => setTab(id)}>
              <Icon className="mr-2 h-4 w-4" /> {label} <span className="ml-2 rounded-full bg-background/20 px-2 py-0.5 text-xs">{count}</span>
            </Button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          Status
          <select className="h-9 rounded-md border bg-background px-3 text-sm text-foreground" value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)}>
            <option value="all">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {loading ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-sm text-muted-foreground"><Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin" />Loading your content…</div>
      ) : tab === "courses" ? (
        <div className="space-y-3">
          {visibleCourses.length ? visibleCourses.map((course) => (
            <article key={course.id} className="rounded-2xl border bg-card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><BookOpen /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold">{course.title}</h3>
                    <StatusPill status={course.publication_status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{course.description || "No course description yet."}</p>
                  <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                    <span><Video className="mr-1 inline h-3.5 w-3.5" />{course.lessonCount} lessons</span>
                    <span><FileArchive className="mr-1 inline h-3.5 w-3.5" />{course.resourceCount} resources</span>
                    <span><GraduationCap className="mr-1 inline h-3.5 w-3.5" />{course.learnerCount} learners</span>
                    <span>Updated {formatDate(course.updated_at)}</span>
                  </div>
                  <PublicationNotice publishedAt={course.published_at} status={course.publication_status} />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {course.publication_status === "published" ? (
                      <Button size="sm" variant="outline" disabled={busyId === course.id} onClick={() => void setCourseStatus(course, "draft")}>Unpublish</Button>
                    ) : (
                      <Button size="sm" disabled={busyId === course.id} onClick={() => void setCourseStatus(course, "published")}>Publish</Button>
                    )}
                    {course.publication_status !== "archived" && (
                      <Button size="sm" variant="outline" disabled={busyId === course.id} onClick={() => void setCourseStatus(course, "archived")}><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button>
                    )}
                    <Button size="sm" variant="destructive" disabled={busyId === course.id} onClick={() => { setDeleteCourse(course); setConfirmation(""); }}>
                      <X className="mr-1 h-3.5 w-3.5" />Delete
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          )) : <EmptyState title="No courses in this view" description="Your courses will appear here after you create them." />}
        </div>
      ) : tab === "lessons" ? (
        <div className="space-y-2">
          {visibleLessons.length ? visibleLessons.map((lesson) => (
            <ContentLine key={lesson.id} icon={Video} title={lesson.title} subtitle={courseNames.get(lesson.course_id) || "Course"} status={lesson.publication_status} detail={`Lesson ${lesson.lesson_order}`} />
          )) : <EmptyState title="No lessons in this view" description="Lessons from your courses will appear here." />}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleResources.length ? visibleResources.map((resource) => (
            <ContentLine key={resource.id} icon={FileArchive} title={resource.resource_name} subtitle={courseNames.get(resource.course_id) || "Course"} status={resource.publication_status} detail={`${resource.file_type.toUpperCase()} · ${formatBytes(resource.file_size_bytes)}`} />
          )) : <EmptyState title="No resources in this view" description="Study files attached to your courses will appear here." />}
        </div>
      )}

      {deleteCourse && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteCourse(null); }}>
          <section role="dialog" aria-modal="true" aria-labelledby="delete-course-title" className="w-full max-w-lg space-y-4 rounded-2xl border bg-background p-5 shadow-2xl">
            <div>
              <h3 id="delete-course-title" className="text-lg font-bold text-destructive">Permanently delete this course?</h3>
              <p className="mt-2 text-sm text-muted-foreground">This permanently removes the course, its lessons, resource records, enrolments, saved references and learner progress. This cannot be undone.</p>
              <p className="mt-2 text-sm font-semibold">{deleteCourse.learnerCount} active or completed learners may lose access.</p>
              {!getContentDeletionEligibility(deleteCourse, new Date()).eligible && (
                <p className="mt-2 text-sm text-amber-600">This course is still inside its 30-day publication protection period. Unpublish or archive it first, or wait until {formatDate(getContentDeletionEligibility(deleteCourse, new Date()).eligibleAt)}.</p>
              )}
            </div>
            <div className="space-y-2">
              <label htmlFor="confirm-course-title" className="text-sm font-medium">Type the exact course title to confirm</label>
              <Input id="confirm-course-title" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder={deleteCourse.title} autoComplete="off" />
            </div>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" onClick={() => setDeleteCourse(null)}>Cancel</Button>
              <Button type="button" variant="destructive" disabled={confirmation !== deleteCourse.title || busyId === deleteCourse.id} onClick={() => void permanentlyDeleteCourse()}>
                {busyId === deleteCourse.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}Delete permanently
              </Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof BookOpen; label: string; value: number }) {
  return <div className="rounded-2xl border bg-card p-4"><div className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="h-4 w-4 text-primary" />{label}</div><p className="mt-2 text-2xl font-bold tabular-nums">{value.toLocaleString()}</p></div>;
}

function StatusPill({ status }: { status: PublicationStatus }) {
  const classes = status === "published" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : status === "archived" ? "border-muted-foreground/30 bg-muted text-muted-foreground" : "border-amber-500/30 bg-amber-500/10 text-amber-600";
  return <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}>{statusLabel[status]}</span>;
}

function PublicationNotice({ publishedAt, status }: { publishedAt: string | null; status: PublicationStatus }) {
  if (status !== "published") return <p className="mt-2 text-xs text-muted-foreground">{statusLabel[status]} · no active 30-day deletion countdown</p>;
  const eligibility = getContentDeletionEligibility({ publication_status: status, published_at: publishedAt });
  if (!eligibility.eligible && eligibility.eligibleAt) {
    return <p className="mt-2 text-xs text-muted-foreground"><Clock3 className="mr-1 inline h-3.5 w-3.5" />Deletion protection until {formatDate(eligibility.eligibleAt)}</p>;
  }
  if (!eligibility.eligible) return <p className="mt-2 text-xs text-amber-600">Publication date unavailable · deletion is blocked for safety</p>;
  return <p className="mt-2 text-xs text-muted-foreground">30-day protection period completed</p>;
}

function ContentLine({ icon: Icon, title, subtitle, status, detail }: { icon: typeof BookOpen; title: string; subtitle: string; status: PublicationStatus; detail: string }) {
  return <article className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4">
    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-muted text-primary"><Icon className="h-5 w-5" /></div>
    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{title}</p><p className="truncate text-xs text-muted-foreground">{subtitle} · {detail}</p></div>
    <StatusPill status={status} />
  </article>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed p-8 text-center"><p className="font-semibold">{title}</p><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>;
}

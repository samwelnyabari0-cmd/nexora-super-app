import { useEffect, useState } from "react";
import { ArrowLeft, BookOpen, FileArchive, GraduationCap, Users, UserRound, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useSocialGraph } from "@/features/social/useSocialGraph";
import { toast } from "sonner";
import type { AcademyEducator } from "./educatorDirectory";
import { SaveLearningButton } from "./SaveLearningButton";

type EducatorCourse = {
  id: string;
  title: string;
  description: string;
  category: string;
  level: string;
  thumbnail_url: string | null;
};

type EducatorLesson = {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  lesson_order: number;
  duration_seconds: number;
  is_preview: boolean;
};

type EducatorResource = {
  id: string;
  course_id: string;
  resource_name: string;
  file_type: string;
  access_tier: string;
};

type EducatorStats = {
  total_courses: number;
  total_lessons: number;
  total_students: number;
};

type ShowcaseTab = "courses" | "lessons" | "resources";

export function EducatorShowcase({
  educatorId,
  onBack,
  onOpenCourse,
}: {
  educatorId: string;
  onBack: () => void;
  onOpenCourse: (courseId: string) => void;
}) {
  const { user } = useSession();
  const [educator, setEducator] = useState<AcademyEducator | null>(null);
  const [stats, setStats] = useState<EducatorStats>({
    total_courses: 0,
    total_lessons: 0,
    total_students: 0,
  });
  const [courses, setCourses] = useState<EducatorCourse[]>([]);
  const [lessons, setLessons] = useState<EducatorLesson[]>([]);
  const [resources, setResources] = useState<EducatorResource[]>([]);
  const [tab, setTab] = useState<ShowcaseTab>("courses");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const graph = useSocialGraph(educatorId);

  useEffect(() => {
    if (graph.error) toast.error(graph.error);
  }, [graph.error]);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setError("Sign in to view educator showcases.");
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    void (async () => {
      const [profileResult, statsResult] = await Promise.all([
        (supabase as any).rpc("get_academy_educator", { p_educator_id: educatorId }),
        (supabase as any).rpc("get_academy_educator_stats", { p_educator_id: educatorId }),
      ]);

      if (!active) return;
      if (profileResult.error || !profileResult.data?.[0]) {
        setError(profileResult.error?.message || "This educator is not available.");
        setEducator(null);
        setLoading(false);
        return;
      }

      setEducator(profileResult.data[0]);
      if (!statsResult.error && statsResult.data?.[0]) {
        setStats(statsResult.data[0]);
      }

      const { data: courseRows, error: courseError } = await (supabase as any)
        .from("edu_courses")
        .select("id, title, description, category, level, thumbnail_url")
        .eq("instructor_id", educatorId)
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (!active) return;
      if (courseError) {
        setError(courseError.message || "Could not load this educator's courses.");
        setLoading(false);
        return;
      }

      const publishedCourses = Array.isArray(courseRows) ? courseRows : [];
      setCourses(publishedCourses);
      const courseIds = publishedCourses.map((course: EducatorCourse) => course.id);

      if (courseIds.length > 0) {
        const [lessonResult, resourceResult] = await Promise.all([
          (supabase as any)
            .from("edu_lessons")
            .select("id, course_id, title, description, lesson_order, duration_seconds, is_preview")
            .in("course_id", courseIds)
            .order("lesson_order", { ascending: true }),
          (supabase as any).rpc("get_academy_public_resource_metadata", {
            p_educator_id: educatorId,
            p_resource_ids: null,
          }),
        ]);

        if (!active) return;
        setLessons(Array.isArray(lessonResult.data) ? lessonResult.data : []);
        setResources(Array.isArray(resourceResult.data) ? resourceResult.data : []);
      } else {
        setLessons([]);
        setResources([]);
      }

      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [educatorId, user?.id]);

  if (!user) {
    return (
      <section className="rounded-2xl border bg-card p-6">
        <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back to educators</Button>
        <p className="mt-4 text-sm text-muted-foreground">Sign in to view educator showcases.</p>
        <Button asChild className="mt-3"><a href="/auth">Sign in</a></Button>
      </section>
    );
  }

  if (loading) {
    return <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading educator showcase…</div>;
  }

  if (error || !educator) {
    return (
      <section className="rounded-2xl border bg-card p-6">
        <Button type="button" variant="ghost" onClick={onBack}><ArrowLeft className="mr-2 h-4 w-4" /> Back to educators</Button>
        <p role="alert" className="mt-4 text-sm text-destructive">{error || "Educator not found."}</p>
      </section>
    );
  }

  const isOwner = user.id === educator.id;
  const tabs: { id: ShowcaseTab; label: string; count: number; icon: typeof BookOpen }[] = [
    { id: "courses", label: "Courses", count: courses.length, icon: BookOpen },
    { id: "lessons", label: "Lessons", count: lessons.length, icon: Video },
    { id: "resources", label: "Public resources", count: resources.length, icon: FileArchive },
  ];

  return (
    <section className="space-y-4" aria-label="Educator showcase">
      <Button type="button" variant="ghost" onClick={onBack} className="-ml-2">
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to educators
      </Button>

      <div className="rounded-3xl border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          {educator.avatar_url ? (
            <img src={educator.avatar_url} alt="" className="h-20 w-20 rounded-2xl object-cover" />
          ) : (
            <div className="grid h-20 w-20 place-items-center rounded-2xl bg-primary/10 text-primary">
              <UserRound className="h-8 w-8" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {educator.account_type === "business" ? "Business · Education" : "Creator · Education"}
            </p>
            <h2 className="mt-1 text-2xl font-bold">{educator.display_name || "Education creator"}</h2>
            {educator.handle && <p className="text-sm text-muted-foreground">@{educator.handle.replace(/^@/, "")}</p>}
            {educator.bio && <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{educator.bio}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!isOwner && (
              <Button type="button" variant={graph.isFollowing ? "outline" : "default"} disabled={graph.loading}
                onClick={() => void graph.toggleFollow()}>
                {graph.loading ? "Loading…" : graph.isFollowing ? "Following" : graph.isPending ? "Requested" : "Follow"}
              </Button>
            )}
            <SaveLearningButton itemType="educator" itemId={educator.id} />
          </div>
        </div>

        {educator.education_skills.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {educator.education_skills.map((skill) => (
              <span key={skill} className="rounded-full border bg-background px-3 py-1.5 text-xs font-medium">{skill}</span>
            ))}
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="rounded-xl bg-muted/70 p-3">
            <BookOpen className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xl font-bold tabular-nums">{stats.total_courses}</p>
            <p className="text-xs text-muted-foreground">Total courses</p>
          </div>
          <div className="rounded-xl bg-muted/70 p-3">
            <Video className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xl font-bold tabular-nums">{stats.total_lessons}</p>
            <p className="text-xs text-muted-foreground">Lessons</p>
          </div>
          <div className="rounded-xl bg-muted/70 p-3">
            <Users className="h-4 w-4 text-primary" />
            <p className="mt-2 text-xl font-bold tabular-nums">{stats.total_students}</p>
            <p className="text-xs text-muted-foreground">Students</p>
          </div>
          <div className="rounded-xl bg-muted/70 p-3">
            <GraduationCap className="h-4 w-4 text-primary" />
            <p className="mt-2 text-sm font-semibold">{graph.followers.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {tabs.map(({ id, label, count, icon: Icon }) => (
          <button type="button" key={id} onClick={() => setTab(id)} aria-pressed={tab === id}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ${tab === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"}`}>
            <Icon className="h-4 w-4" /> {label} <span className="text-xs opacity-70">{count}</span>
          </button>
        ))}
      </div>

      {tab === "courses" && (courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-7 text-center">
          <BookOpen className="mx-auto h-7 w-7 text-muted-foreground" />
          <p className="mt-3 font-semibold">No Academy courses yet</p>
          <p className="mt-1 text-sm text-muted-foreground">This educator has set up an Education profile and may publish courses later.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {courses.map((course) => (
            <article key={course.id} className="overflow-hidden rounded-2xl border bg-card">
              {course.thumbnail_url && <img src={course.thumbnail_url} alt="" className="h-32 w-full object-cover" />}
              <div className="p-4">
                <p className="text-xs capitalize text-muted-foreground">{course.category} · {course.level}</p>
                <h3 className="mt-1 font-semibold">{course.title}</h3>
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{course.description}</p>
                <div className="mt-4 flex items-center gap-2"><Button type="button" variant="outline" className="min-w-0 flex-1" onClick={() => onOpenCourse(course.id)}>View course</Button><SaveLearningButton itemType="course" itemId={course.id} /></div>
              </div>
            </article>
          ))}
        </div>
      ))}

      {tab === "lessons" && (lessons.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">No public or preview lessons are available yet.</div>
      ) : (
        <div className="space-y-2">
          {lessons.map((lesson) => (
            <article key={lesson.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <Video className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{lesson.title}</p>
                <p className="text-xs text-muted-foreground">{lesson.is_preview ? "Free preview" : "Available to enrolled students"} · {Math.max(1, Math.round(lesson.duration_seconds / 60))} min</p>
              </div>
              <div className="flex shrink-0 items-center gap-1"><SaveLearningButton itemType="lesson" itemId={lesson.id} /><Button type="button" size="sm" variant="outline" onClick={() => onOpenCourse(lesson.course_id)}>Open course</Button></div>
            </article>
          ))}
        </div>
      ))}

      {tab === "resources" && (resources.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-7 text-center text-sm text-muted-foreground">No public resources are available yet.</div>
      ) : (
        <div className="space-y-2">
          {resources.map((resource) => (
            <article key={resource.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <FileArchive className="h-4 w-4 shrink-0 text-primary" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{resource.resource_name}</p>
                <p className="text-xs text-muted-foreground">{resource.file_type}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1"><span className="rounded-full bg-muted px-2 py-1 text-[10px]">Public</span><SaveLearningButton itemType="resource" itemId={resource.id} /></div>
            </article>
          ))}
        </div>
      ))}
    </section>
  );
}

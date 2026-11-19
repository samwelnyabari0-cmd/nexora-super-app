import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, BookOpen, Bookmark, BookmarkCheck, ChevronRight, CloudUpload, Code2, Download, FileArchive, GraduationCap, Layers3, LockKeyhole, Play, Search, Sparkles, CheckCircle2, Store, Video, X, Clock3 } from "lucide-react";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { EducatorDirectory } from "@/features/academy/EducatorDirectory";
import { EducatorShowcase } from "@/features/academy/EducatorShowcase";
import { SavedLearningPanel } from "@/features/academy/SavedLearningPanel";
import { SaveLearningButton } from "@/features/academy/SaveLearningButton";
import { importLegacySavedCourses, saveLearningItem, unsaveLearningItem } from "@/features/academy/savedLearning";

export const Route = createFileRoute("/learn")({
  head: () => ({ meta: [{ title: "Academy Hub — NEXORA" }, { name: "description", content: "Learn, build, and earn with Nexora Academy." }] }),
  component: Learn,
});

type Track = "all" | "creator" | "tech" | "business";
type Course = { id: string; title: string; description: string; category: Exclude<Track, "all">; level: string; lessons: number; durationSeconds: number; priceUsd: number; priceKes: number; currency: string; thumbnailUrl: string | null; instructorName: string; instructorAvatar: string | null; progress: number; accent: string; icon: typeof Video };
type Resource = { id: string; name: string; type: string; size: number; key: string };
type Lesson = { id: string; title: string; lessonOrder: number; videoPath: string; durationSeconds: number; isPreview: boolean };
type LessonProgress = { completed: boolean; lastPositionSeconds: number };
type StudentCourseProgress = { course: Course; completed: number; total: number; percent: number; status: string };
const accents = ["from-cyan-500/25 to-blue-500/5", "from-violet-500/25 to-fuchsia-500/5", "from-amber-500/25 to-orange-500/5"];
const icons = [Code2, Video, Store];

function Learn() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [track, setTrack] = useState<Track>("all");
  const [searchMode, setSearchMode] = useState<"courses" | "educators">("courses");
  const [selectedEducatorId, setSelectedEducatorId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [myLearning, setMyLearning] = useState<StudentCourseProgress[]>([]);
  const [myLearningLoading, setMyLearningLoading] = useState(false);
  const [showMyLearning, setShowMyLearning] = useState(false);
  const [myLearningView, setMyLearningView] = useState<"courses" | "saved">("courses");
  const [savedCourseIds, setSavedCourseIds] = useState<string[]>([]);
  const [savedCoursesLoaded, setSavedCoursesLoaded] = useState(false);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [showResourceLibrary, setShowResourceLibrary] = useState(false);
  const [resourceQuery, setResourceQuery] = useState("");
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [enrollmentStatus, setEnrollmentStatus] = useState<"idle" | "loading" | "enrolling" | "enrolled">("idle");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [lessonProgress, setLessonProgress] = useState<Record<string, LessonProgress>>({});
  const [lessonsLoading, setLessonsLoading] = useState(false);
  const [activeLesson, setActiveLesson] = useState<Lesson | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const lastProgressSave = useRef<Record<string, number>>({});
  const legacyImportUser = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("nexora-academy-saved-courses") ?? "[]");
      setSavedCourseIds(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : []);
    } catch {
      setSavedCourseIds([]);
    } finally {
      setSavedCoursesLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!savedCoursesLoaded || user) return;
    localStorage.setItem("nexora-academy-saved-courses", JSON.stringify(savedCourseIds));
  }, [savedCourseIds, savedCoursesLoaded, user?.id]);

  useEffect(() => {
    if (!savedCoursesLoaded) return;
    if (!user) {
      legacyImportUser.current = null;
      return;
    }
    if (legacyImportUser.current === user.id) return;

    let active = true;
    void (async () => {
      let legacyIds: string[] = [];
      try {
        const stored = JSON.parse(localStorage.getItem("nexora-academy-saved-courses") ?? "[]");
        legacyIds = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
      } catch {
        legacyIds = [];
      }

      if (legacyIds.length === 0) {
        legacyImportUser.current = user.id;
        return;
      }

      const result = await importLegacySavedCourses(user.id, legacyIds);
      if (!active) return;
      if (result.error) {
        toast.error("Your saved courses are still on this device. We could not sync them yet.");
        return;
      }
      localStorage.removeItem("nexora-academy-saved-courses");
      legacyImportUser.current = user.id;
    })();

    return () => {
      active = false;
    };
  }, [savedCoursesLoaded, savedCourseIds, user?.id]);

  async function toggleSavedCourse(courseId: string) {
    const isSaved = savedCourseIds.includes(courseId);
    if (user) {
      const result = isSaved
        ? await unsaveLearningItem(user.id, "course", courseId)
        : await saveLearningItem(user.id, "course", courseId);
      if (result.error) {
        toast.error(result.error.message || "Could not update your saved courses.");
        return;
      }
    }
    setSavedCourseIds((current) => isSaved ? current.filter((id) => id !== courseId) : [...current, courseId]);
    toast.success(isSaved ? "Removed from saved courses." : "Course saved to your list.");
  }

  useEffect(() => {
    let active = true;
    async function loadAcademy() {
      setLoading(true);
      setError(null);
      const { data: rows, error: courseError } = await (supabase as any)
        .from("edu_courses")
        .select("id,title,description,category,level,price_usd,price_kes,currency,thumbnail_url,instructor_id")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (courseError) {
        if (active) { setError(courseError.message); setLoading(false); }
        return;
      }
      const ids = (rows ?? []).map((row: any) => row.id);
      let lessonRows: any[] = [];
      let resourceRows: any[] = [];
      if (ids.length) {
        const [lessonsResult, resourcesResult] = await Promise.all([
          (supabase as any).from("edu_lessons").select("course_id,duration_seconds").in("course_id", ids),
          (supabase as any).from("edu_resources").select("id,course_id,resource_name,file_type,file_size_bytes,r2_object_key").in("course_id", ids),
        ]);
        if (lessonsResult.error) {
          if (active) { setError(lessonsResult.error.message); setLoading(false); }
          return;
        }
        lessonRows = lessonsResult.data ?? [];
        resourceRows = resourcesResult.data ?? [];
      }
      const counts = lessonRows.reduce((acc: Record<string, { count: number; seconds: number }>, row: any) => {
        acc[row.course_id] ??= { count: 0, seconds: 0 };
        acc[row.course_id].count += 1;
        acc[row.course_id].seconds += Number(row.duration_seconds ?? 0);
        return acc;
      }, {});
      const instructorIds = [...new Set((rows ?? []).map((row: any) => row.instructor_id).filter(Boolean))];
      const { data: instructorRows } = instructorIds.length ? await (supabase as any).from("profiles").select("id,display_name,handle,avatar_url").in("id", instructorIds) : { data: [] };
      const instructors = Object.fromEntries((instructorRows ?? []).map((row: any) => [row.id, row]));
      if (active) {
        setCourses((rows ?? []).map((row: any, index: number) => {
          const categoryText = String(row.category ?? "").toLowerCase();
          const category: Exclude<Track, "all"> = categoryText.includes("creator") ? "creator" : categoryText.includes("business") || categoryText.includes("commerce") ? "business" : "tech";
          return {
            id: row.id, title: row.title, description: row.description ?? "",
            category, level: row.level ?? "All levels", lessons: counts[row.id]?.count ?? 0, durationSeconds: counts[row.id]?.seconds ?? 0,
            priceUsd: Number(row.price_usd ?? 0), priceKes: Number(row.price_kes ?? 0),
            currency: row.currency ?? "KES", thumbnailUrl: row.thumbnail_url ?? null,
            instructorName: instructors[row.instructor_id]?.display_name || instructors[row.instructor_id]?.handle || "Nexora Instructor",
            instructorAvatar: instructors[row.instructor_id]?.avatar_url ?? null,
            progress: 0, accent: accents[index % accents.length], icon: icons[index % icons.length],
          };
        }));
        setResources(resourceRows.map((row: any) => ({
          id: row.id, name: row.resource_name, type: String(row.file_type ?? "FILE").toUpperCase(),
          size: Number(row.file_size_bytes ?? 0), key: row.r2_object_key,
        })));
        setLoading(false);
      }
    }
    void loadAcademy();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    async function loadMyLearning() {
      if (!user) { setMyLearning([]); setMyLearningLoading(false); return; }
      if (!courses.length) return;
      setMyLearningLoading(true);
      const { data: enrollments, error: enrollmentError } = await (supabase as any)
        .from("edu_enrollments").select("course_id,status").eq("student_id", user.id).in("status", ["active", "completed"]);
      if (!active) return;
      if (enrollmentError || !enrollments?.length) { setMyLearning([]); setMyLearningLoading(false); return; }
      const enrolledIds = enrollments.map((row: any) => row.course_id);
      const enrolledCourses = courses.filter((course) => enrolledIds.includes(course.id));
      const [{ data: lessonRows }, { data: progressRows }] = await Promise.all([
        (supabase as any).from("edu_lessons").select("id,course_id").in("course_id", enrolledIds),
        (supabase as any).from("edu_lesson_progress").select("lesson_id,completed").eq("student_id", user.id),
      ]);
      if (!active) return;
      const lessonsByCourse: Record<string, string[]> = {};
      (lessonRows ?? []).forEach((row: any) => { (lessonsByCourse[row.course_id] ??= []).push(row.id); });
      const completedIds = new Set((progressRows ?? []).filter((row: any) => row.completed).map((row: any) => row.lesson_id));
      const statusByCourse = Object.fromEntries(enrollments.map((row: any) => [row.course_id, row.status]));
      setMyLearning(enrolledCourses.map((course) => {
        const lessonIds = lessonsByCourse[course.id] ?? [];
        const completed = lessonIds.filter((id) => completedIds.has(id)).length;
        const total = lessonIds.length;
        return { course, completed, total, percent: total ? Math.round((completed / total) * 100) : 0, status: statusByCourse[course.id] };
      }));
      setMyLearningLoading(false);
    }
    void loadMyLearning();
    return () => { active = false; };
  }, [user?.id, courses]);

  useEffect(() => {
    let active = true;
    async function checkEnrollment() {
      if (!selectedCourse || !user) { setEnrollmentStatus("idle"); return; }
      setEnrollmentStatus("loading");
      const { data, error: enrollmentError } = await (supabase as any)
        .from("edu_enrollments")
        .select("status")
        .eq("course_id", selectedCourse.id)
        .eq("student_id", user.id)
        .maybeSingle();
      if (!active) return;
      setEnrollmentStatus(!enrollmentError && data && ["active", "completed"].includes(data.status) ? "enrolled" : "idle");
    }
    void checkEnrollment();
    return () => { active = false; };
  }, [selectedCourse, user]);

  useEffect(() => {
    let active = true;
    async function loadCourseLessons() {
      if (!selectedCourse) {
        setLessons([]);
        setLessonProgress({});
        setActiveLesson(null);
        setVideoUrl(null);
        return;
      }
      setLessonsLoading(true);
      setLessons([]);
      setLessonProgress({});
      setActiveLesson(null);
      setVideoUrl(null);
      const { data, error: lessonError } = await (supabase as any)
        .from("edu_lessons")
        .select("id,title,lesson_order,video_url,duration_seconds,is_preview")
        .eq("course_id", selectedCourse.id)
        .order("lesson_order", { ascending: true });
      if (!active) return;
      if (lessonError) {
        toast.error("Unable to load course lessons: " + lessonError.message);
        setLessonsLoading(false);
        return;
      }
      const lessonRows: Lesson[] = (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        lessonOrder: Number(row.lesson_order),
        videoPath: row.video_url,
        durationSeconds: Number(row.duration_seconds ?? 0),
        isPreview: Boolean(row.is_preview),
      }));
      setLessons(lessonRows);
      if (user && enrollmentStatus === "enrolled" && lessonRows.length) {
        const { data: progressRows, error: progressError } = await (supabase as any)
          .from("edu_lesson_progress")
          .select("lesson_id,completed,last_position_seconds")
          .eq("student_id", user.id)
          .in("lesson_id", lessonRows.map((lesson) => lesson.id));
        if (!active) return;
        if (!progressError) {
          const progressMap: Record<string, LessonProgress> = {};
          (progressRows ?? []).forEach((row: any) => {
            progressMap[row.lesson_id] = {
              completed: Boolean(row.completed),
              lastPositionSeconds: Number(row.last_position_seconds ?? 0),
            };
          });
          setLessonProgress(progressMap);
        }
      }
      setLessonsLoading(false);
    }
    void loadCourseLessons();
    return () => { active = false; };
  }, [selectedCourse?.id, enrollmentStatus, user?.id]);

  async function openLesson(lesson: Lesson) {
    setVideoLoading(true);
    setActiveLesson(lesson);
    setVideoUrl(null);
    const { data, error: signedError } = await supabase.storage
      .from("academy-videos")
      .createSignedUrl(lesson.videoPath, 300);
    if (signedError || !data?.signedUrl) {
      setVideoLoading(false);
      toast.error(signedError?.message ?? "This lesson is not available to your account.");
      return;
    }
    setVideoUrl(data.signedUrl);
    setVideoLoading(false);
  }

  async function saveLessonProgress(lesson: Lesson, position: number, completed = false) {
    if (!user || enrollmentStatus !== "enrolled") return;
    const safePosition = Math.max(0, Math.floor(position || 0));
    const nextProgress = {
      completed: completed || Boolean(lessonProgress[lesson.id]?.completed),
      lastPositionSeconds: safePosition,
    };
    const { error: saveError } = await (supabase as any)
      .from("edu_lesson_progress")
      .upsert({
        lesson_id: lesson.id,
        student_id: user.id,
        completed: nextProgress.completed,
        last_position_seconds: safePosition,
        updated_at: new Date().toISOString(),
      }, { onConflict: "lesson_id,student_id" });
    if (saveError) {
      toast.error("Could not save lesson progress: " + saveError.message);
      return;
    }
    setLessonProgress((current) => ({ ...current, [lesson.id]: nextProgress }));
  }

  async function enrollSelectedCourse() {
    if (!selectedCourse) return;
    if (!user) { toast.error("Sign in to enrol in this course."); return; }
    if (selectedCourse.priceUsd !== 0 || selectedCourse.priceKes !== 0) {
      toast.info("This course is paid. Secure payment verification will be added before paid enrolment is enabled.");
      return;
    }
    setEnrollmentStatus("enrolling");
    const { error: enrolError } = await supabase.rpc("enroll_in_free_edu_course", { p_course_id: selectedCourse.id });
    if (enrolError) {
      toast.error(enrolError.message);
      setEnrollmentStatus("idle");
      return;
    }
    setEnrollmentStatus("enrolled");
    toast.success("You are enrolled. Your course lessons are now unlocked.");
  }

  const filteredResources = useMemo(() => resources.filter((resource) => `${resource.name} ${resource.type}`.toLowerCase().includes(resourceQuery.trim().toLowerCase())), [resources, resourceQuery]);

  const filteredCourses = useMemo(() => courses.filter((course) =>
    (track === "all" || course.category === track) &&
    (!showSavedOnly || savedCourseIds.includes(course.id)) &&
    `${course.title} ${course.description}`.toLowerCase().includes(query.toLowerCase())
  ), [courses, track, query, showSavedOnly, savedCourseIds]);

  function durationLabel(seconds: number) {
    if (!seconds) return "Self-paced";
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return hours ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  }

  function priceLabel(course: Course) {
    if (course.priceUsd === 0 && course.priceKes === 0) return "Free";
    const kes = course.priceKes > 0 ? `KSh ${course.priceKes.toLocaleString()}` : "";
    const usd = course.priceUsd > 0 ? `$${course.priceUsd.toLocaleString()}` : "";
    return [kes, usd].filter(Boolean).join(" · ");
  }

  async function downloadResource(resource: Resource) {
    try {
      toast.info("Preparing your secure download…");
      const { data, error: signedError } = await supabase.storage.from("academy-resources").createSignedUrl(resource.key, 60);
      if (signedError || !data?.signedUrl) throw signedError ?? new Error("This resource is not available to your account.");
      const link = document.createElement("a");
      link.href = data.signedUrl;
      link.download = resource.name;
      link.click();
      toast.success("Download started.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to prepare this download.");
    }
  }

  return <div className="space-y-5">
    <PageHeader title="Academy Hub" action={<div className="flex flex-wrap items-center justify-end gap-2"><DemoBadge>Learning workspace</DemoBadge><Button type="button" size="sm" title="My Learning" aria-label="Open My Learning dashboard" onClick={() => setShowMyLearning(true)} className="group relative h-10 overflow-hidden rounded-xl border border-cyan-300/40 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 px-3 font-semibold text-white shadow-lg shadow-cyan-500/25 transition-all hover:-translate-y-0.5 hover:shadow-cyan-500/40"><span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full" /><BookOpen className="relative mr-2 h-4 w-4" /><span className="relative">My Learning</span><Sparkles className="relative ml-2 h-3.5 w-3.5 text-cyan-100" /></Button><Button size="sm" onClick={() => navigate({ to: "/creator/academy" })} className="group relative overflow-hidden border border-cyan-300/30 bg-gradient-to-r from-cyan-500 via-blue-600 to-violet-600 font-semibold text-white shadow-lg shadow-cyan-500/20 transition-all hover:-translate-y-0.5 hover:shadow-cyan-500/40"><span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-700 group-hover:translate-x-full" /><CloudUpload className="relative mr-1 h-4 w-4" /><span className="relative">Creator Academy</span><Sparkles className="relative ml-1 h-3.5 w-3.5" /></Button></div>} />
    <section className="relative overflow-hidden rounded-3xl border bg-card p-5 md:p-6"><div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative max-w-2xl"><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Sparkles className="h-4 w-4" /> Learn, build, earn</p><h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">Your next skill compounds.</h1><p className="mt-4 max-w-xl text-muted-foreground">Explore courses published by Nexora instructors, with secure learning resources.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => document.getElementById("course-catalog")?.scrollIntoView({ behavior: "smooth" })}>Browse courses <ArrowRight /></Button><Button variant="outline" onClick={() => setShowResourceLibrary(true)}>Resource library</Button></div></div></section>
    <section className="grid grid-cols-3 overflow-hidden rounded-2xl border bg-card divide-x divide-border"><button type="button" onClick={() => { setShowSavedOnly(false); document.getElementById("course-catalog")?.scrollIntoView({ behavior: "smooth" }); }} className="min-w-0 p-3 text-left transition hover:bg-muted/40 sm:p-4"><div className="flex items-center gap-2 text-primary"><BookOpen className="h-4 w-4" /><span className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">Published</span></div><p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{courses.length}</p><p className="hidden text-[11px] text-muted-foreground sm:block">Courses</p></button><button type="button" onClick={() => { setShowSavedOnly(false); document.getElementById("course-catalog")?.scrollIntoView({ behavior: "smooth" }); }} className="min-w-0 p-3 text-left transition hover:bg-muted/40 sm:p-4"><div className="flex items-center gap-2 text-violet-400"><Video className="h-4 w-4" /><span className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">Lessons</span></div><p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{courses.reduce((sum, course) => sum + course.lessons, 0)}</p><p className="hidden text-[11px] text-muted-foreground sm:block">Across courses</p></button><button type="button" onClick={() => setShowResourceLibrary(true)} className="min-w-0 p-3 text-left transition hover:bg-muted/40 sm:p-4"><div className="flex items-center gap-2 text-emerald-400"><FileArchive className="h-4 w-4" /><span className="truncate text-[11px] font-medium text-muted-foreground sm:text-xs">Resources</span></div><p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl">{resources.length}</p><p className="hidden text-[11px] text-muted-foreground sm:block">Study files</p></button></section>
    
    <section id="course-catalog" className="scroll-mt-20 space-y-3">
    <div className="flex gap-2 rounded-xl border bg-card p-1" role="tablist" aria-label="Academy search type">
      <button type="button" role="tab" aria-selected={searchMode === "courses"} onClick={() => { setSearchMode("courses"); setSelectedEducatorId(null); }}
        className={cn("flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition", searchMode === "courses" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}>
        <BookOpen className="mr-2 inline h-4 w-4" /> Search courses
      </button>
      <button type="button" role="tab" aria-selected={searchMode === "educators"} onClick={() => { setSearchMode("educators"); setShowSavedOnly(false); }}
        className={cn("flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition", searchMode === "educators" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted")}>
        <GraduationCap className="mr-2 inline h-4 w-4" /> Instructors &amp; Creators
      </button>
    </div>
    {searchMode === "educators" ? (
      selectedEducatorId ? (
        <EducatorShowcase educatorId={selectedEducatorId}
          onBack={() => setSelectedEducatorId(null)}
          onOpenCourse={(courseId) => {
            const course = courses.find((item) => item.id === courseId);
            if (course) {
              setSelectedCourse(course);
              setSelectedEducatorId(null);
            } else {
              toast.error("This course is not available in the current catalog.");
            }
          }} />
      ) : <EducatorDirectory onSelectEducator={setSelectedEducatorId} />
    ) : (
      <>
    <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Curriculum stream</p><h2 className="mt-1 text-2xl font-bold">Find your next course</h2></div><label className="flex min-w-56 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground"><Search className="h-4 w-4" /><span className="sr-only">Search courses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" /></label></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{([["all", "All tracks"], ["creator", "Creator skills"], ["tech", "Developer & tech"], ["business", "E-commerce & business"]] as const).map(([id, label]) => <button type="button" key={id} onClick={() => { setTrack(id); setShowSavedOnly(false); }} className={cn("whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium", track === id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}<button type="button" onClick={() => setShowSavedOnly((value) => !value)} className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-3 py-2 text-sm font-medium", showSavedOnly ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "text-muted-foreground hover:text-foreground")}><Bookmark className="h-3.5 w-3.5" /> Saved ({savedCourseIds.length})</button></div>
    {loading ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading published courses…</div> : error ? <div className="rounded-2xl border border-destructive/40 bg-card p-6 text-sm text-destructive">Unable to load Academy courses: {error}</div> : filteredCourses.length === 0 ? <div className="rounded-2xl border border-dashed bg-gradient-to-br from-cyan-500/5 via-card to-violet-500/5 p-8 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10"><GraduationCap className="h-6 w-6 text-primary" /></div><p className="mt-3 font-semibold">{showSavedOnly ? "No saved courses yet" : query ? "No matching courses" : "Your Academy starts here"}</p><p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{showSavedOnly ? "Tap the bookmark on any course to keep it close." : query ? "Try another search or choose a different track." : "Instructors can publish courses for learners to discover here."}</p>{showSavedOnly ? <Button variant="outline" size="sm" className="mt-4" onClick={() => setShowSavedOnly(false)}>Browse all courses</Button> : !query && <Button size="sm" className="mt-4" onClick={() => navigate({ to: "/creator/academy" })}>Create a course <ArrowRight /></Button>}</div> : <div className="grid gap-4 lg:grid-cols-3">{filteredCourses.map((course) => { const Icon = course.icon; const saved = savedCourseIds.includes(course.id); return <article key={course.id} className="group overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:border-primary/50"><div className={`relative flex h-36 items-end overflow-hidden bg-gradient-to-br ${course.accent} p-4`}>{course.thumbnailUrl ? <img src={course.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" loading="lazy" /> : <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, rgba(255,255,255,.22), transparent 35%), linear-gradient(135deg, transparent 35%, rgba(255,255,255,.12))" }} />}<div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-black/10" /><div className="relative grid h-10 w-10 place-items-center rounded-xl border border-white/25 bg-black/30 text-white backdrop-blur"><Icon className="h-5 w-5" /></div><button type="button" aria-label={saved ? "Remove saved course" : "Save course"} title={saved ? "Remove saved course" : "Save course"} onClick={() => toggleSavedCourse(course.id)} className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full border border-white/30 bg-black/45 text-white backdrop-blur transition hover:scale-105 hover:bg-black/70">{saved ? <BookmarkCheck className="h-4 w-4 text-amber-300" /> : <Bookmark className="h-4 w-4" />}</button><span className="relative ml-auto rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">{course.category} track</span></div><div className="space-y-3 p-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-purple-500/15 px-2.5 py-1 text-[11px] font-semibold capitalize text-purple-300">{course.level}</span><span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", course.priceUsd === 0 && course.priceKes === 0 ? "bg-emerald-500/15 text-emerald-300" : "bg-muted text-muted-foreground")}>{priceLabel(course)}</span></div><h3 className="line-clamp-2 font-semibold">{course.title}</h3><p className="line-clamp-2 min-h-10 text-sm leading-5 text-muted-foreground">{course.description}</p><div className="flex items-center gap-2 border-t pt-3"><div className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-xs font-semibold">{course.instructorAvatar ? <img src={course.instructorAvatar} alt="" className="h-full w-full object-cover" /> : course.instructorName.slice(0,1).toUpperCase()}</div><span className="min-w-0 flex-1 truncate text-xs font-medium">{course.instructorName}</span><span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{durationLabel(course.durationSeconds)}</span></div><div className="flex items-center justify-between gap-3 pt-1"><span className="text-xs text-muted-foreground">{course.lessons} lessons</span><Button size="sm" variant="outline" onClick={() => setSelectedCourse(course)}>View course<ChevronRight /></Button></div></div></article>; })}</div>}</>)}
    </section>
    {showResourceLibrary && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="resource-library-title"><div className="my-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border bg-card p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Study materials</p><h2 id="resource-library-title" className="mt-1 text-2xl font-bold">Resource library</h2><p className="mt-1 text-sm text-muted-foreground">Find and download course files available to your account.</p></div><Button variant="ghost" size="icon" aria-label="Close resource library" onClick={() => { setShowResourceLibrary(false); setResourceQuery(""); }}><X /></Button></div><label className="mt-5 flex items-center gap-2 rounded-xl border bg-background px-3 py-3 text-sm text-muted-foreground"><Search className="h-4 w-4 shrink-0" /><span className="sr-only">Search resources</span><input value={resourceQuery} onChange={(event) => setResourceQuery(event.target.value)} placeholder="Search by resource name or file type…" className="w-full bg-transparent text-foreground outline-none placeholder:text-muted-foreground" /></label><div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm font-medium">Available resources</p><span className="text-xs text-muted-foreground">{filteredResources.length} of {resources.length}</span></div>{resources.length === 0 ? <div className="mt-3 rounded-2xl border bg-background p-6 text-center text-sm text-muted-foreground"><FileArchive className="mx-auto mb-2 h-7 w-7" />No resources are currently available to your account.</div> : filteredResources.length === 0 ? <div className="mt-3 rounded-2xl border border-dashed p-6 text-center"><Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground" /><p className="font-medium">No matching resources</p><p className="mt-1 text-sm text-muted-foreground">Try another resource name or file type.</p></div> : <div className="mt-3 grid gap-3 md:grid-cols-2">{filteredResources.map((resource) => <button type="button" key={resource.id} className="flex w-full items-center gap-3 rounded-2xl border bg-background p-4 text-left transition hover:border-primary/50 hover:bg-muted/30" onClick={() => void downloadResource(resource)}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted"><Layers3 className="h-5 w-5 text-primary" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{resource.name}</p><p className="mt-1 text-xs text-muted-foreground">{resource.type} · {(resource.size / (1024 * 1024)).toFixed(1)} MB</p></div><Download className="h-4 w-4 text-muted-foreground" /></button>)}</div>}</div></div>}
    {showMyLearning && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="my-learning-title"><div className="my-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-3xl border bg-card p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">Your student dashboard</p><h2 id="my-learning-title" className="mt-1 text-2xl font-bold">My Learning</h2><p className="mt-1 text-sm text-muted-foreground">Track your progress and continue where you left off.</p></div><Button variant="ghost" size="icon" aria-label="Close My Learning dashboard" onClick={() => setShowMyLearning(false)}><X /></Button></div>{!user ? <div className="mt-5 rounded-2xl border p-5 text-sm text-muted-foreground">Sign in to see your enrolled courses and learning progress.</div> : myLearningLoading ? <div className="mt-5 rounded-2xl border p-5 text-sm text-muted-foreground">Loading your learning dashboard…</div> : myLearning.length === 0 ? <div className="mt-5 rounded-2xl border p-5"><p className="font-semibold">Your learning journey starts here</p><p className="mt-1 text-sm text-muted-foreground">Enrol in a course to see it here and track your progress.</p></div> : <div className="mt-5 grid gap-3 sm:grid-cols-2">{myLearning.map((item) => <article key={item.course.id} className="rounded-2xl border bg-background p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs capitalize text-muted-foreground">{item.course.category} track</p><h3 className="mt-1 font-semibold">{item.course.title}</h3></div><span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">{item.percent}%</span></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-violet-500 transition-all" style={{ width: item.percent + "%" }} /></div><div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{item.completed} of {item.total} lessons completed</span><span className="capitalize">{item.status}</span></div><Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => { setShowMyLearning(false); setSelectedCourse(item.course); }}>{item.percent === 100 ? "Review course" : item.completed > 0 ? "Continue learning" : "Start learning"} <ArrowRight /></Button></article>)}</div>}</div></div>}
    {selectedCourse && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-background/80 p-3 backdrop-blur-sm sm:p-5" role="dialog" aria-modal="true" aria-labelledby="course-dialog-title"><div className="my-auto w-full max-w-5xl rounded-3xl border bg-card p-4 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{selectedCourse.category} track</p><h2 id="course-dialog-title" className="mt-2 text-2xl font-bold">{selectedCourse.title}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{selectedCourse.description}</p></div><Button variant="ghost" size="icon" aria-label="Close course details" onClick={() => { setSelectedCourse(null); setVideoUrl(null); setActiveLesson(null); }}><X /></Button></div><div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(260px,0.8fr)]"><div className="space-y-4"><div className="overflow-hidden rounded-2xl border bg-black">{videoUrl && activeLesson ? <video key={videoUrl} className="aspect-video w-full" src={videoUrl} controls playsInline preload="metadata" onLoadedMetadata={(event) => { const saved = lessonProgress[activeLesson.id]; if (saved && saved.lastPositionSeconds > 0 && saved.lastPositionSeconds < event.currentTarget.duration - 2) event.currentTarget.currentTime = saved.lastPositionSeconds; }} onPause={(event) => { void saveLessonProgress(activeLesson, event.currentTarget.currentTime); }} onEnded={(event) => { void saveLessonProgress(activeLesson, event.currentTarget.duration || event.currentTarget.currentTime, true); toast.success("Lesson completed!"); }} onTimeUpdate={(event) => { if (enrollmentStatus !== "enrolled") return; const currentTime = Math.floor(event.currentTarget.currentTime); const previous = lastProgressSave.current[activeLesson.id] ?? 0; if (currentTime >= previous + 15) { lastProgressSave.current[activeLesson.id] = currentTime; void saveLessonProgress(activeLesson, currentTime); } }} /> : <div className="grid aspect-video place-items-center p-6 text-center text-white">{videoLoading ? <div className="space-y-2"><div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-white/30 border-t-white" /><p className="text-sm">Preparing secure lesson video…</p></div> : <div><Play className="mx-auto h-10 w-10 text-cyan-300" /><p className="mt-3 font-semibold">{activeLesson ? "Video is being prepared" : "Choose a lesson to start learning"}</p><p className="mt-1 text-xs text-white/60">Private course video · secure access</p></div>}</div>}</div><div className="flex flex-wrap items-center justify-between gap-2"><div><p className="text-xs text-muted-foreground">Now learning</p><p className="font-semibold">{activeLesson?.title ?? "No lesson selected"}</p></div>{activeLesson && lessonProgress[activeLesson.id]?.completed && <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">Completed</span>}</div></div><aside className="space-y-3"><div className="grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-xl bg-muted p-3"><BookOpen className="mx-auto mb-1 h-4 w-4" />{selectedCourse.lessons} lessons</div><div className="rounded-xl bg-muted p-3"><LockKeyhole className="mx-auto mb-1 h-4 w-4" />{priceLabel(selectedCourse)}</div></div><Button className="w-full" disabled={enrollmentStatus === "loading" || enrollmentStatus === "enrolling" || enrollmentStatus === "enrolled"} onClick={() => void enrollSelectedCourse()}>{enrollmentStatus === "loading" ? "Checking enrolment…" : enrollmentStatus === "enrolling" ? "Enrolling…" : enrollmentStatus === "enrolled" ? "You are enrolled" : selectedCourse.priceUsd === 0 && selectedCourse.priceKes === 0 ? "Enrol for free" : "View payment options"} <ArrowRight /></Button><div className="flex items-center justify-between pt-2"><h3 className="font-semibold">Course lessons</h3><span className="text-xs text-muted-foreground">{lessons.length} available</span></div>{lessonsLoading ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">Loading lessons…</p> : lessons.length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No preview lessons are available yet.</p> : <div className="max-h-[42vh] space-y-2 overflow-y-auto pr-1">{lessons.map((lesson) => { const locked = !lesson.isPreview && enrollmentStatus !== "enrolled"; const completed = Boolean(lessonProgress[lesson.id]?.completed); return <button key={lesson.id} type="button" disabled={locked} onClick={() => void openLesson(lesson)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", activeLesson?.id === lesson.id ? "border-primary bg-primary/10" : "hover:border-primary/50", locked && "cursor-not-allowed opacity-60")}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">{locked ? <LockKeyhole className="h-4 w-4" /> : completed ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <Play className="h-4 w-4 text-primary" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{lesson.lessonOrder}. {lesson.title}</span><span className="mt-1 block text-xs text-muted-foreground">{locked ? "Enrolment required" : lesson.isPreview ? "Free preview" : completed ? "Completed" : "Tap to play"}</span></span></button>; })}</div>}</aside></div></div></div>}
  </div>;
}
function Stat({ icon: Icon, label, value, detail }: { icon: typeof BookOpen; label: string; value: string; detail: string }) { return <div className="rounded-2xl border bg-card p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }

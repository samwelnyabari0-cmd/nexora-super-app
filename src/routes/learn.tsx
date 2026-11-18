import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, BookOpen, ChevronRight, CloudUpload, Code2, Download, FileArchive, Layers3, LockKeyhole, Play, Search, Sparkles, Store, Video, X } from "lucide-react";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/learn")({
  head: () => ({ meta: [{ title: "Academy Hub — NEXORA" }, { name: "description", content: "Learn, build, and earn with Nexora Academy." }] }),
  component: Learn,
});

type Track = "all" | "creator" | "tech" | "business";
type Course = { id: string; title: string; description: string; category: Exclude<Track, "all">; level: string; lessons: number; priceUsd: number; priceKes: number; currency: string; progress: number; accent: string; icon: typeof Video };
type Resource = { id: string; name: string; type: string; size: number; key: string };
const accents = ["from-cyan-500/25 to-blue-500/5", "from-violet-500/25 to-fuchsia-500/5", "from-amber-500/25 to-orange-500/5"];
const icons = [Code2, Video, Store];

function Learn() {
  const navigate = useNavigate();
  const [track, setTrack] = useState<Track>("all");
  const [query, setQuery] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [resources, setResources] = useState<Resource[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadAcademy() {
      setLoading(true);
      setError(null);
      const { data: rows, error: courseError } = await (supabase as any)
        .from("edu_courses")
        .select("id,title,description,category,level,price_usd,price_kes,currency")
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
          (supabase as any).from("edu_lessons").select("course_id").in("course_id", ids),
          (supabase as any).from("edu_resources").select("id,course_id,resource_name,file_type,file_size_bytes,r2_object_key").in("course_id", ids),
        ]);
        if (lessonsResult.error) {
          if (active) { setError(lessonsResult.error.message); setLoading(false); }
          return;
        }
        lessonRows = lessonsResult.data ?? [];
        resourceRows = resourcesResult.data ?? [];
      }
      const counts = lessonRows.reduce((acc: Record<string, number>, row: any) => {
        acc[row.course_id] = (acc[row.course_id] ?? 0) + 1;
        return acc;
      }, {});
      if (active) {
        setCourses((rows ?? []).map((row: any, index: number) => {
          const categoryText = String(row.category ?? "").toLowerCase();
          const category: Exclude<Track, "all"> = categoryText.includes("creator") ? "creator" : categoryText.includes("business") || categoryText.includes("commerce") ? "business" : "tech";
          return {
            id: row.id, title: row.title, description: row.description ?? "",
            category, level: row.level ?? "All levels", lessons: counts[row.id] ?? 0,
            priceUsd: Number(row.price_usd ?? 0), priceKes: Number(row.price_kes ?? 0),
            currency: row.currency ?? "KES", progress: 0, accent: accents[index % accents.length], icon: icons[index % icons.length],
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

  const filteredCourses = useMemo(() => courses.filter((course) =>
    (track === "all" || course.category === track) &&
    `${course.title} ${course.description}`.toLowerCase().includes(query.toLowerCase())
  ), [courses, track, query]);

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

  return <div className="space-y-8">
    <PageHeader title="Academy Hub" action={<DemoBadge>Learning workspace</DemoBadge>} />
    <section className="relative overflow-hidden rounded-3xl border bg-card p-6 md:p-8"><div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" /><div className="relative max-w-2xl"><p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300"><Sparkles className="h-4 w-4" /> Learn, build, earn</p><h1 className="font-display text-3xl font-bold tracking-tight md:text-5xl">Your next skill compounds.</h1><p className="mt-4 max-w-xl text-muted-foreground">Explore courses published by Nexora instructors, with secure learning resources.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => document.getElementById("course-catalog")?.scrollIntoView({ behavior: "smooth" })}>Browse courses <ArrowRight /></Button><Button variant="outline" onClick={() => document.getElementById("resources")?.scrollIntoView({ behavior: "smooth" })}>Resource library</Button><Button variant="secondary" onClick={() => navigate({ to: "/creator/academy" })}><CloudUpload /> Creator Academy</Button></div></div></section>
    <section className="grid gap-3 sm:grid-cols-3"><Stat icon={BookOpen} label="Published courses" value={String(courses.length)} detail="Live from Nexora Academy" /><Stat icon={Video} label="Lessons" value={String(courses.reduce((sum, course) => sum + course.lessons, 0))} detail="Across published courses" /><Stat icon={FileArchive} label="Resources" value={String(resources.length)} detail="Access depends on enrolment" /></section>
    <section id="course-catalog" className="scroll-mt-20 space-y-4"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Curriculum stream</p><h2 className="mt-1 text-2xl font-bold">Find your next course</h2></div><label className="flex min-w-56 items-center gap-2 rounded-xl border bg-card px-3 py-2 text-sm text-muted-foreground"><Search className="h-4 w-4" /><span className="sr-only">Search courses</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search courses" className="w-full bg-transparent outline-none placeholder:text-muted-foreground" /></label></div>
    <div className="flex gap-2 overflow-x-auto pb-1">{([["all", "All tracks"], ["creator", "Creator skills"], ["tech", "Developer & tech"], ["business", "E-commerce & business"]] as const).map(([id, label]) => <button type="button" key={id} onClick={() => setTrack(id)} className={cn("whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium", track === id ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground")}>{label}</button>)}</div>
    {loading ? <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">Loading published courses…</div> : error ? <div className="rounded-2xl border border-destructive/40 bg-card p-6 text-sm text-destructive">Unable to load Academy courses: {error}</div> : filteredCourses.length === 0 ? <div className="rounded-2xl border bg-card p-8 text-center"><BookOpen className="mx-auto h-8 w-8 text-muted-foreground" /><p className="mt-3 font-semibold">No published courses yet</p><p className="mt-1 text-sm text-muted-foreground">{query ? "Try another search term." : "Courses published by instructors will appear here."}</p></div> : <div className="grid gap-4 lg:grid-cols-3">{filteredCourses.map((course) => { const Icon = course.icon; return <article key={course.id} className="group overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:border-primary/50"><div className={`flex h-32 items-end bg-gradient-to-br ${course.accent} p-5`}><div className="grid h-11 w-11 place-items-center rounded-2xl border bg-background/70"><Icon className="h-5 w-5 text-primary" /></div></div><div className="space-y-3 p-5"><div className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span className="capitalize">{course.category} track</span><span>{course.level}</span></div><h3 className="font-semibold">{course.title}</h3><p className="min-h-12 text-sm leading-5 text-muted-foreground">{course.description}</p><div className="text-xs text-muted-foreground">{course.lessons} lessons</div><div className="flex items-center justify-between gap-3 pt-1"><span className="text-sm font-semibold">{priceLabel(course)}</span><Button size="sm" variant="outline" onClick={() => setSelectedCourse(course)}>View course<ChevronRight /></Button></div></div></article>; })}</div>}</section>
    <section id="resources" className="scroll-mt-20 space-y-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Assignment & resource library</p><h2 className="mt-1 text-2xl font-bold">Course resources</h2><p className="mt-2 text-sm text-muted-foreground">Private files are available only to instructors and eligible enrolled students.</p></div>{resources.length === 0 ? <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">No resources are currently available to your account.</div> : <div className="grid gap-3 md:grid-cols-3">{resources.map((resource) => <button type="button" key={resource.id} className="flex w-full items-center gap-3 rounded-2xl border bg-card p-4 text-left transition hover:border-primary/50 hover:bg-muted/30" onClick={() => void downloadResource(resource)}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted"><Layers3 className="h-5 w-5 text-primary" /></div><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{resource.name}</p><p className="mt-1 text-xs text-muted-foreground">{resource.type} · {(resource.size / (1024 * 1024)).toFixed(1)} MB</p></div><Download className="h-4 w-4 text-muted-foreground" /></button>)}</div>}</section>
    {selectedCourse && <div className="fixed inset-0 z-50 grid place-items-center bg-background/80 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="course-dialog-title"><div className="w-full max-w-lg rounded-3xl border bg-card p-6 shadow-2xl"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">{selectedCourse.category} track</p><h2 id="course-dialog-title" className="mt-2 text-2xl font-bold">{selectedCourse.title}</h2></div><Button variant="ghost" size="icon" aria-label="Close course details" onClick={() => setSelectedCourse(null)}><X /></Button></div><p className="mt-4 text-sm leading-6 text-muted-foreground">{selectedCourse.description}</p><div className="mt-5 grid grid-cols-2 gap-2 text-center text-xs"><div className="rounded-xl bg-muted p-3"><BookOpen className="mx-auto mb-1 h-4 w-4" />{selectedCourse.lessons} lessons</div><div className="rounded-xl bg-muted p-3"><LockKeyhole className="mx-auto mb-1 h-4 w-4" />{priceLabel(selectedCourse)}</div></div><Button className="mt-6 w-full" onClick={() => { setSelectedCourse(null); toast.info("Course enrolment and lesson playback are the next Academy features being connected."); }}>Continue <ArrowRight /></Button></div></div>}
  </div>;
}
function Stat({ icon: Icon, label, value, detail }: { icon: typeof BookOpen; label: string; value: string; detail: string }) { return <div className="rounded-2xl border bg-card p-4"><Icon className="h-5 w-5 text-primary" /><p className="mt-4 text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>; }

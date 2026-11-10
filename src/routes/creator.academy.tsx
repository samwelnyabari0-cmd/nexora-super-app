import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { BookOpen, CheckCircle2, FileArchive, FileText, Plus, Upload, Video, X } from "lucide-react";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { toast } from "sonner";

export const Route = createFileRoute("/creator/academy")({
  head: () => ({ meta: [{ title: "Instructor Portal — NEXORA" }, { name: "description", content: "Create Nexora Academy courses and securely publish lessons and resources." }] }),
  component: InstructorAcademy,
});

type LessonFile = { id: string; file: File; title: string };
function InstructorAcademy() {
  const { user } = useSession();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("tech");
  const [description, setDescription] = useState("");
  const [priceUsd, setPriceUsd] = useState("0");
  const [priceKes, setPriceKes] = useState("0");
  const [lessons, setLessons] = useState<LessonFile[]>([]);
  const [resources, setResources] = useState<File[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  function addLessons(files: FileList | null) { if (!files) return; setLessons((current) => [...current, ...Array.from(files).filter((file) => file.type.startsWith("video/")).map((file) => ({ id: crypto.randomUUID(), file, title: file.name.replace(/\.[^.]+$/, "") }))]); }
  function addResources(files: FileList | null) { if (!files) return; setResources((current) => [...current, ...Array.from(files).filter((file) => /pdf|zip|text|word|presentation/.test(file.type) || /\.(pdf|zip|txt|docx?|pptx?)$/i.test(file.name))]); }
  async function publishCourse() {
    if (!user) { toast.error("Sign in as an instructor to publish a course."); return; }
    if (!title.trim() || !description.trim() || !lessons.length) { toast.error("Add a title, description, and at least one video lesson."); return; }
    setPublishing(true);
    try {
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}-${Date.now()}`;
      const { data: course, error: courseError } = await (supabase as any).from("edu_courses").insert({ instructor_id: user.id, title: title.trim(), slug, description: description.trim(), category, price_usd: Number(priceUsd) || 0, price_kes: Number(priceKes) || 0, is_published: true }).select("id").single();
      if (courseError) throw courseError;
      for (const [index, lesson] of lessons.entries()) {
        const path = `${user.id}/${course.id}/lessons/${crypto.randomUUID()}-${lesson.file.name}`;
        const { error: uploadError } = await supabase.storage.from("academy-videos").upload(path, lesson.file, { contentType: lesson.file.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: lessonError } = await (supabase as any).from("edu_lessons").insert({ course_id: course.id, title: lesson.title, lesson_order: index + 1, video_url: path, duration_seconds: 0, is_preview: index < 2 });
        if (lessonError) throw lessonError;
      }
      for (const resource of resources) {
        const path = `${user.id}/${course.id}/resources/${crypto.randomUUID()}-${resource.name}`;
        const { error: uploadError } = await supabase.storage.from("academy-resources").upload(path, resource, { contentType: resource.type, upsert: false });
        if (uploadError) throw uploadError;
        const { error: resourceError } = await (supabase as any).from("edu_resources").insert({ course_id: course.id, resource_name: resource.name, file_type: resource.name.split(".").pop()?.toLowerCase() ?? "file", r2_object_key: path, file_size_bytes: resource.size, access_tier: "enrolled" });
        if (resourceError) throw resourceError;
      }
      setPublished(true); toast.success("Course published to Nexora Academy.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Course publishing failed."); }
    finally { setPublishing(false); }
  }
  return <div className="space-y-6"><PageHeader title="Instructor Portal" action={<DemoBadge>Academy publishing</DemoBadge>} /><section className="rounded-3xl border bg-card p-6"><div className="flex items-start gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10"><BookOpen className="text-primary" /></div><div><h1 className="text-2xl font-bold">Create a new course</h1><p className="mt-1 text-sm text-muted-foreground">Publish video lessons and secure study materials for the Nexora community.</p></div></div></section>{published && <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-sm"><CheckCircle2 className="text-emerald-400" /> Your course and lesson metadata are now in Academy.</div>}<div className="grid gap-6 lg:grid-cols-[1fr_360px]"><main className="space-y-6 rounded-3xl border bg-card p-6"><div className="grid gap-4 sm:grid-cols-2"><div className="sm:col-span-2"><Label htmlFor="course-title">Course title</Label><Input id="course-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="React & WebGL Bootcamp" /></div><div><Label>Category</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="creator">Creator Skill</SelectItem><SelectItem value="tech">Developer & Tech</SelectItem><SelectItem value="business">E-Commerce & Business</SelectItem></SelectContent></Select></div><div><Label htmlFor="price-usd">Price (USD)</Label><Input id="price-usd" type="number" min="0" value={priceUsd} onChange={(event) => setPriceUsd(event.target.value)} /></div><div><Label htmlFor="price-kes">Price (KES)</Label><Input id="price-kes" type="number" min="0" value={priceKes} onChange={(event) => setPriceKes(event.target.value)} /></div><div className="sm:col-span-2"><Label htmlFor="description">Course description</Label><Textarea id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What will students build or learn?" rows={5} /></div></div><UploadZone icon={Video} title="Video lessons" description="MP4, WebM, or MOV. The first two lessons can be free previews." accept="video/*" multiple onChange={(event) => addLessons(event.target.files)} /><div className="space-y-2">{lessons.map((lesson, index) => <div key={lesson.id} className="flex items-center gap-3 rounded-xl border p-3"><Video className="h-4 w-4 text-cyan-400" /><Input aria-label={`Lesson ${index + 1} title`} value={lesson.title} onChange={(event) => setLessons((current) => current.map((item) => item.id === lesson.id ? { ...item, title: event.target.value } : item))} /><span className="text-xs text-muted-foreground">{(lesson.file.size / 1024 / 1024).toFixed(1)} MB</span><Button variant="ghost" size="icon" aria-label="Remove lesson" onClick={() => setLessons((current) => current.filter((item) => item.id !== lesson.id))}><X /></Button></div>)}</div><UploadZone icon={FileArchive} title="Notes, books & assignment resources" description="PDF, TXT, DOCX, PPTX, and ZIP files are stored behind enrollment checks." accept=".pdf,.txt,.doc,.docx,.ppt,.pptx,.zip" multiple onChange={(event) => addResources(event.target.files)} /><div className="space-y-2">{resources.map((resource) => <div key={`${resource.name}-${resource.size}`} className="flex items-center gap-3 rounded-xl border p-3"><FileText className="h-4 w-4 text-violet-400" /><span className="min-w-0 flex-1 truncate text-sm">{resource.name}</span><span className="text-xs text-muted-foreground">{(resource.size / 1024 / 1024).toFixed(1)} MB</span><Button variant="ghost" size="icon" aria-label="Remove resource" onClick={() => setResources((current) => current.filter((item) => item !== resource))}><X /></Button></div>)}</div></main><aside className="h-fit space-y-4 rounded-3xl border bg-card p-6"><p className="text-sm font-semibold">Publishing checklist</p><ul className="space-y-3 text-sm text-muted-foreground"><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Course metadata and pricing</li><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Video processing pipeline</li><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> Secure resource storage</li><li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" /> First two lessons marked preview</li></ul><Button className="w-full" onClick={() => void publishCourse()} disabled={publishing}>{publishing ? "Publishing…" : <><Upload /> Publish course</>}</Button></aside></div></div>;
}
function UploadZone({ icon: Icon, title, description, accept, multiple, onChange }: { icon: typeof Video; title: string; description: string; accept: string; multiple?: boolean; onChange: (event: React.ChangeEvent<HTMLInputElement>) => void }) { return <label className="block cursor-pointer rounded-2xl border border-dashed p-5 transition hover:border-primary/60 hover:bg-muted/20"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-muted"><Icon className="h-5 w-5 text-primary" /></div><div className="flex-1"><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{description}</p></div><Plus className="h-5 w-5 text-muted-foreground" /></div><input className="sr-only" type="file" accept={accept} multiple={multiple} onChange={onChange} /></label>; }

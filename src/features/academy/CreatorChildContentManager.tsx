import { useState } from "react";
import { Archive, ArrowDown, ArrowUp, Copy, FileArchive, Pencil, Save, Trash2, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { getContentDeletionEligibility, type PublicationStatus } from "./creatorContent";

type Lesson = { id: string; course_id: string; title: string; lesson_order: number; video_url?: string; publication_status: PublicationStatus; published_at: string | null };
type Resource = { id: string; course_id: string; resource_name: string; file_type: string; file_size_bytes: number; r2_object_key?: string; display_order?: number; publication_status: PublicationStatus; published_at: string | null };
type Props = { lessons: Lesson[]; resources: Resource[]; filter: "all" | PublicationStatus; courseNames: Map<string, string>; onChanged: () => Promise<void> };

export function CreatorChildContentManager({ lessons, resources, filter, courseNames, onChanged }: Props) {\n  const visibleLessons = lessons.filter((item) => filter === "all" || item.publication_status === filter);\n  const visibleResources = resources.filter((item) => filter === "all" || item.publication_status === filter);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; kind: "lesson" | "resource"; title: string } | null>(null);

  async function updateStatus(kind: "lesson" | "resource", item: Lesson | Resource, status: PublicationStatus) {
    setBusy(item.id);
    try {
      const table = kind === "lesson" ? "edu_lessons" : "edu_resources";
      const { error } = await (supabase as any).from(table).update({ publication_status: status }).eq("id", item.id);
      if (error) throw error;
      toast.success(status === "published" ? "Published. A new 30-day protection period has started." : status === "archived" ? "Archived. The active deletion countdown has stopped." : "Unpublished. The active deletion countdown has stopped.");
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not update publication status."); }
    finally { setBusy(null); }
  }

  async function saveTitle() {
    if (!editing || !editing.title.trim()) return;
    setBusy(editing.id);
    try {
      const table = editing.kind === "lesson" ? "edu_lessons" : "edu_resources";
      const field = editing.kind === "lesson" ? "title" : "resource_name";
      const { error } = await (supabase as any).from(table).update({ [field]: editing.title.trim() }).eq("id", editing.id);
      if (error) throw error;
      setEditing(null);
      toast.success("Content title updated.");
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the title."); }
    finally { setBusy(null); }
  }

  async function duplicateLesson(item: Lesson) {
    setBusy(item.id);
    try {
      let newPath: string | null = null;
      if (item.video_url) {
        const { data, error } = await supabase.storage.from("academy-videos").createSignedUrl(item.video_url, 60);
        if (error || !data?.signedUrl) throw error ?? new Error("Could not access the source video.");
        const response = await fetch(data.signedUrl);
        if (!response.ok) throw new Error("Could not copy the source video.");
        const blob = await response.blob();
        const path = item.video_url.includes("/") ? item.video_url.slice(0, item.video_url.lastIndexOf("/") + 1) : "";
        newPath = `${path}${crypto.randomUUID()}-copy-${item.title.replace(/[^a-z0-9._-]/gi, "-")}.mp4`;
        const { error: uploadError } = await supabase.storage.from("academy-videos").upload(newPath, blob, { contentType: blob.type || "video/mp4", upsert: false });
        if (uploadError) throw uploadError;
      }
      const { error } = await (supabase as any).from("edu_lessons").insert({
        course_id: item.course_id, title: `${item.title} (Copy)`, lesson_order: Math.max(0, ...lessons.filter((row) => row.course_id === item.course_id).map((row) => row.lesson_order)) + 1,
        video_url: newPath, duration_seconds: 0, is_preview: false, publication_status: "draft",
      });
      if (error) {
        if (newPath) await supabase.storage.from("academy-videos").remove([newPath]);
        throw error;
      }
      toast.success("Lesson duplicated as a draft. Learner progress was not copied.");
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not duplicate this lesson."); }
    finally { setBusy(null); }
  }

  async function duplicateResource(item: Resource) {
    setBusy(item.id);
    try {
      if (!item.r2_object_key) throw new Error("This resource has no stored file path, so it cannot be safely duplicated.");
      const { data, error } = await supabase.storage.from("academy-resources").createSignedUrl(item.r2_object_key, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("Could not access the source resource.");
      const response = await fetch(data.signedUrl);
      if (!response.ok) throw new Error("Could not copy the source resource.");
      const blob = await response.blob();
      const path = item.r2_object_key.includes("/") ? item.r2_object_key.slice(0, item.r2_object_key.lastIndexOf("/") + 1) : "";
      const newPath = `${path}${crypto.randomUUID()}-copy-${item.resource_name.replace(/[^a-z0-9._-]/gi, "-")}`;
      const { error: uploadError } = await supabase.storage.from("academy-resources").upload(newPath, blob, { contentType: blob.type || "application/octet-stream", upsert: false });
      if (uploadError) throw uploadError;
      const { error: insertError } = await (supabase as any).from("edu_resources").insert({
        course_id: item.course_id, resource_name: `${item.resource_name} (Copy)`, file_type: item.file_type,
        r2_object_key: newPath, file_size_bytes: blob.size, access_tier: "enrolled", publication_status: "draft",\n        display_order: Math.max(0, ...resources.filter((row) => row.course_id === item.course_id).map((row) => row.display_order ?? 0)) + 1,
      });
      if (insertError) {
        await supabase.storage.from("academy-resources").remove([newPath]);
        throw insertError;
      }
      toast.success("Resource duplicated as a draft with its own file copy.");
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not duplicate this resource."); }
    finally { setBusy(null); }
  }

  async function moveLesson(item: Lesson, direction: -1 | 1) {
    const ordered = lessons.filter((row) => row.course_id === item.course_id).sort((a, b) => a.lesson_order - b.lesson_order);
    const index = ordered.findIndex((row) => row.id === item.id);
    const target = ordered[index + direction];
    if (!target) return;
    setBusy(item.id);
    try {
      const first = await (supabase as any).from("edu_lessons").update({ lesson_order: target.lesson_order }).eq("id", item.id);
      if (first.error) throw first.error;
      const second = await (supabase as any).from("edu_lessons").update({ lesson_order: item.lesson_order }).eq("id", target.id);
      if (second.error) throw second.error;
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reorder lessons."); }
    finally { setBusy(null); }
  }

  async function moveResource(item: Resource, direction: -1 | 1) {
    const ordered = resources.filter((row) => row.course_id === item.course_id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
    const index = ordered.findIndex((row) => row.id === item.id);
    const target = ordered[index + direction];
    if (!target) return;
    setBusy(item.id);
    try {
      const first = await (supabase as any).from("edu_resources").update({ display_order: target.display_order ?? index + direction + 1 }).eq("id", item.id);
      if (first.error) throw first.error;
      const second = await (supabase as any).from("edu_resources").update({ display_order: item.display_order ?? index + 1 }).eq("id", target.id);
      if (second.error) throw second.error;
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not reorder resources."); }
    finally { setBusy(null); }
  }

  async function deleteChild(kind: "lesson" | "resource", item: Lesson | Resource) {
    const eligibility = getContentDeletionEligibility(item);
    if (!eligibility.eligible) {
      toast.error(eligibility.eligibleAt ? `This item is protected until ${new Date(eligibility.eligibleAt).toLocaleDateString()}.` : "Deletion is blocked because its publication date is unavailable.");
      return;
    }
    const title = kind === "lesson" ? (item as Lesson).title : (item as Resource).resource_name;
    if (!window.confirm(`Permanently delete "${title}"? This cannot be undone.`)) return;
    setBusy(item.id);
    try {
      const table = kind === "lesson" ? "edu_lessons" : "edu_resources";
      const { error } = await (supabase as any).from(table).delete().eq("id", item.id);
      if (error) throw error;
      const path = kind === "lesson" ? (item as Lesson).video_url : (item as Resource).r2_object_key;
      if (path) {
        const bucket = kind === "lesson" ? "academy-videos" : "academy-resources";
        const { error: storageError } = await supabase.storage.from(bucket).remove([path]);
        if (storageError) toast.error("Record deleted, but its stored file could not be removed. Contact support to clean up the unused file.");
      }
      toast.success(`${kind === "lesson" ? "Lesson" : "Resource"} deleted.`);
      await onChanged();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Deletion failed. Published content is protected for 30 days."); }
    finally { setBusy(null); }
  }

  return <div className="space-y-6">
    <section className="space-y-3">
      <h3 className="font-semibold">Lesson controls</h3>
      {visibleLessons.length ? visibleLessons.map((item) => {
        const protectedItem = !getContentDeletionEligibility(item).eligible;
        const ordered = lessons.filter((row) => row.course_id === item.course_id).sort((a, b) => a.lesson_order - b.lesson_order);
        const index = ordered.findIndex((row) => row.id === item.id);
        return <article key={item.id} className="rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Video className="h-4 w-4 text-primary" />
            {editing?.id === item.id ? <Input aria-label="Lesson title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="min-w-32 flex-1" /> : <strong className="min-w-32 flex-1 text-sm">{item.title}</strong>}
            <span className="text-xs text-muted-foreground">{courseNames.get(item.course_id) ?? "Course"} · #{item.lesson_order}</span>
            <span className="rounded-full border px-2 py-0.5 text-xs">{item.publication_status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.publication_status === "published" ? protectedItem ? "Protected for 30 days from publication" : "30-day protection completed" : "No active deletion countdown"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {editing?.id === item.id ? <><Button size="sm" onClick={() => void saveTitle()} disabled={busy === item.id}><Save className="mr-1 h-3.5 w-3.5" />Save</Button><Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button></> : <Button size="sm" variant="outline" onClick={() => setEditing({ id: item.id, kind: "lesson", title: item.title })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}
            <Button size="sm" variant="outline" disabled={busy === item.id || index === 0} onClick={() => void moveLesson(item, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" disabled={busy === item.id || index === ordered.length - 1} onClick={() => void moveLesson(item, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void duplicateLesson(item)}><Copy className="mr-1 h-3.5 w-3.5" />Duplicate</Button>
            {item.publication_status === "published" ? <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void updateStatus("lesson", item, "draft")}>Unpublish</Button> : <Button size="sm" disabled={busy === item.id} onClick={() => void updateStatus("lesson", item, "published")}>Publish</Button>}
            {item.publication_status !== "archived" && <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void updateStatus("lesson", item, "archived")}><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button>}
            <Button size="sm" variant="destructive" disabled={busy === item.id || protectedItem} onClick={() => void deleteChild("lesson", item)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
          </div>
        </article>;
      }) : <p className="text-sm text-muted-foreground">No lessons yet.</p>}
    </section>
    <section className="space-y-3">
      <h3 className="font-semibold">Resource controls</h3>
      {visibleResources.length ? visibleResources.map((item) => {
        const protectedItem = !getContentDeletionEligibility(item).eligible;
        const ordered = resources.filter((row) => row.course_id === item.course_id).sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        const index = ordered.findIndex((row) => row.id === item.id);
        return <article key={item.id} className="rounded-xl border bg-card p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FileArchive className="h-4 w-4 text-primary" />
            {editing?.id === item.id ? <Input aria-label="Resource title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="min-w-32 flex-1" /> : <strong className="min-w-32 flex-1 text-sm">{item.resource_name}</strong>}
            <span className="text-xs text-muted-foreground">{courseNames.get(item.course_id) ?? "Course"} · {item.file_type.toUpperCase()}</span>
            <span className="rounded-full border px-2 py-0.5 text-xs">{item.publication_status}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{item.publication_status === "published" ? protectedItem ? "Protected for 30 days from publication" : "30-day protection completed" : "No active deletion countdown"}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {editing?.id === item.id ? <><Button size="sm" onClick={() => void saveTitle()} disabled={busy === item.id}><Save className="mr-1 h-3.5 w-3.5" />Save</Button><Button size="sm" variant="outline" onClick={() => setEditing(null)}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button></> : <Button size="sm" variant="outline" onClick={() => setEditing({ id: item.id, kind: "resource", title: item.resource_name })}><Pencil className="mr-1 h-3.5 w-3.5" />Edit</Button>}
            <Button size="sm" variant="outline" disabled={busy === item.id || index === 0} onClick={() => void moveResource(item, -1)}><ArrowUp className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" disabled={busy === item.id || index === ordered.length - 1} onClick={() => void moveResource(item, 1)}><ArrowDown className="h-3.5 w-3.5" /></Button>
            <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void duplicateResource(item)}><Copy className="mr-1 h-3.5 w-3.5" />Duplicate</Button>
            {item.publication_status === "published" ? <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void updateStatus("resource", item, "draft")}>Unpublish</Button> : <Button size="sm" disabled={busy === item.id} onClick={() => void updateStatus("resource", item, "published")}>Publish</Button>}
            {item.publication_status !== "archived" && <Button size="sm" variant="outline" disabled={busy === item.id} onClick={() => void updateStatus("resource", item, "archived")}><Archive className="mr-1 h-3.5 w-3.5" />Archive</Button>}
            <Button size="sm" variant="destructive" disabled={busy === item.id || protectedItem} onClick={() => void deleteChild("resource", item)}><Trash2 className="mr-1 h-3.5 w-3.5" />Delete</Button>
          </div>
        </article>;
      }) : <p className="text-sm text-muted-foreground">No resources yet.</p>}
    </section>
  </div>;
}

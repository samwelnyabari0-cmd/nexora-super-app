import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, Save, Trash2, Image, Film, FileText } from "lucide-react";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";
import { fileError } from "@/features/core/tools";
import { PageHeader, DemoBadge } from "@/components/nexora/ui";
import { StudioCapture } from "@/components/nexora/StudioCapture";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
export const Route = createFileRoute("/create")({
  head: () => ({
    meta: [
      { title: "Creator Studio Plus — NEXORA" },
      {
        name: "description",
        content: "Capture photos and clips, style media, compose posts and manage session drafts.",
      },
      { property: "og:title", content: "Creator Studio Plus — NEXORA" },
      {
        property: "og:description",
        content: "Capture photos and clips, style media, compose posts and manage session drafts.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Create,
});
function Create() {
  const { createPost, online, relay } = useApp();
  const { drafts, saveDraft, removeDraft, notify, preferences } = useWorkspace();
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("creators");
  const [audience, setAudience] = useState<"public" | "private">(
    preferences.privateProfile ? "private" : "public",
  );
  const [media, setMedia] = useState<string>();
  const [mediaType, setMediaType] = useState<string>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("original");
  const [format, setFormat] = useState("landscape");
  const input = useRef<HTMLInputElement>(null);
  const tagList = tags
    .split(",")
    .map((t) => t.trim().replace(/^#/, ""))
    .filter(Boolean);
  const draft = (key: string) => ({
    id: key,
    caption,
    media,
    mediaType,
    tags: tagList,
    audience,
    filter,
    format,
  });
  const queued = relay.some(
    (item) => item.kind === "post" && (item.payload as { draftId?: string }).draftId === id,
  );
  const reset = () => {
    setId("");
    setCaption("");
    setTags("creators");
    setMedia(undefined);
    setMediaType(undefined);
    setFilter("original");
    setFormat("landscape");
    setError("");
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Creator Studio Plus" action={<DemoBadge>Local publishing</DemoBadge>} />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          <div
            className={cn(
              "grid w-full overflow-hidden rounded-2xl border bg-muted",
              `format-${format}`,
            )}
          >
            {media ? (
              mediaType?.startsWith("video/") ? (
                <video
                  src={media}
                  controls
                  playsInline
                  className={cn("h-full max-h-[65dvh] w-full object-cover", `media-${filter}`)}
                  onError={() =>
                    setError("Video format unsupported by this browser. Choose another file.")
                  }
                />
              ) : (
                <img
                  src={media}
                  alt="Selected media"
                  className={cn("h-full max-h-[65dvh] w-full object-cover", `media-${filter}`)}
                  onError={() => setError("Image could not be opened. Choose another file.")}
                />
              )
            ) : (
              <Image className="m-auto h-12 w-12 text-muted-foreground" />
            )}
          </div>
          <StudioCapture
            onCapture={(url, type) => {
              setMedia(url);
              setMediaType(type);
              setError("");
            }}
            onError={setError}
          />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => input.current?.click()}>
              <Upload />
              Upload
            </Button>
            {media && (
              <Button
                variant="ghost"
                size="icon"
                title="Remove media"
                aria-label="Remove media"
                onClick={() => {
                  setMedia(undefined);
                  setMediaType(undefined);
                }}
              >
                <Trash2 />
              </Button>
            )}
            <Button variant="ghost" onClick={reset}>
              <FileText />
              New composition
            </Button>
          </div>
          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            aria-label="Upload media"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (!f) return;
              const problem = fileError(f);
              if (problem) {
                setError(problem);
                return;
              }
              if (!f.type.startsWith("image/") && !f.type.startsWith("video/")) {
                setError("Choose an image or video.");
                return;
              }
              setError("");
              setMedia(URL.createObjectURL(f));
              setMediaType(f.type);
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Color treatment</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Media filter">
              {["original", "vivid", "mono", "cinema", "soft"].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={filter === f ? "default" : "outline"}
                  aria-pressed={filter === f}
                  className="capitalize"
                  onClick={() => setFilter(f)}
                >
                  {f}
                </Button>
              ))}
            </div>
            <h2 className="text-sm font-semibold">Frame</h2>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Media frame">
              {["landscape", "portrait", "square"].map((f) => (
                <Button
                  key={f}
                  size="sm"
                  variant={format === f ? "default" : "outline"}
                  aria-pressed={format === f}
                  className="capitalize"
                  onClick={() => setFormat(f)}
                >
                  <Film />
                  {f}
                </Button>
              ))}
            </div>
          </section>
        </div>
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!caption.trim() || queued) return;
            let key = id;
            if (!online) {
              key = id || crypto.randomUUID();
              saveDraft(draft(key));
            }
            createPost(
              {
                caption: caption.trim(),
                image: media,
                mediaType,
                audience,
                filter,
                format,
                kind: mediaType?.startsWith("video/") ? "video" : "post",
                tags: tagList,
              },
              key || undefined,
            );
            notify(
              online ? "Post published locally" : "Post queued",
              "Session-only post. No public publishing service connected.",
            );
            void nav({ to: "/" });
          }}
        >
          <label className="block space-y-2 text-sm font-semibold">
            Caption
            <textarea
              aria-label="Caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              rows={5}
              className="w-full rounded-xl border bg-card p-3"
              placeholder="What’s the scene?"
            />
          </label>
          <label className="block space-y-2 text-sm">
            Tags
            <input
              aria-label="Tags"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full rounded-lg border bg-card px-3 py-2"
            />
          </label>
          <label className="block space-y-2 text-sm">
            Audience
            <select
              aria-label="Audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value === "private" ? "private" : "public")}
              className="w-full rounded-lg border bg-card p-2"
            >
              <option value="public">Public (local demo)</option>
              <option value="private">Only me (local demo)</option>
            </select>
          </label>
          <Button className="w-full bg-brand" disabled={!caption.trim() || queued}>
            {queued ? "Already queued" : online ? "Publish locally" : "Queue in Offline Relay"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={(!caption.trim() && !media) || queued}
            onClick={() => {
              const key = id || crypto.randomUUID();
              setId(key);
              saveDraft(draft(key));
            }}
          >
            <Save />
            Save draft
          </Button>
          <p className="text-xs text-muted-foreground">
            Drafts and posts reset on refresh. Media stays on this device. Filters and framing apply
            in NEXORA, not to the source file.
          </p>
        </form>
      </div>
      <section>
        <h2 className="mb-3 text-lg font-semibold">Drafts · {drafts.length}</h2>
        {!drafts.length && <p className="text-sm text-muted-foreground">No drafts yet.</p>}
        {drafts.map((d) => {
          const pending = relay.some(
            (r) => r.kind === "post" && (r.payload as { draftId?: string }).draftId === d.id,
          );
          return (
            <div key={d.id} className="flex items-center gap-3 border-b py-3">
              <Button
                variant="ghost"
                className="h-auto min-w-0 flex-1 justify-start whitespace-normal text-left"
                onClick={() => {
                  setId(d.id);
                  setCaption(d.caption);
                  setTags(d.tags.join(", "));
                  setMedia(d.media);
                  setMediaType(d.mediaType);
                  setAudience(d.audience);
                  setFilter(d.filter || "original");
                  setFormat(d.format || "landscape");
                }}
              >
                {d.caption || "Untitled draft"}
                {pending && " · Queued locally"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Delete draft"
                disabled={pending}
                onClick={() => removeDraft(d.id)}
              >
                <Trash2 />
              </Button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

import AdvancedVideoStudioEditor from "@/components/nexora/AdvancedVideoStudioEditor";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { Upload, Save, Trash2, Image, Film, FileText, ShieldCheck, Sparkles, Music2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";

import { PageHeader } from "@/components/nexora/ui";
import { StudioCapture } from "@/components/nexora/StudioCapture";
import { CoverPicker } from "@/components/nexora/CoverPicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accountTierFromUser, UPLOAD_POLICY, validateUpload } from "@/lib/upload-policy";
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
  const { user } = useSession();
  const { drafts, saveDraft, removeDraft, notify, preferences } = useWorkspace();
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("creators");
  const [audience, setAudience] = useState<"public" | "private">(
    preferences.privateProfile ? "private" : "public",
  );
  const [media, setMedia] = useState<string>();
  const [mediaFiles, setMediaFiles] = useState<Blob[]>([]);
  const [mediaType, setMediaType] = useState<string>();
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("original");
  const [format, setFormat] = useState("square");
  const [music, setMusic] = useState("none");
  const [cover, setCover] = useState<Blob | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const uploadTier = accountTierFromUser(user);
  const uploadLimits = UPLOAD_POLICY[uploadTier];
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
    setMediaFiles([]);
    setMediaType(undefined);
    setCover(null);
    setFilter("original");
    setFormat("landscape");
    setError("");
  };
  return (
    <div className="space-y-6">
      <PageHeader title="Creator Studio Plus" subtitle={user ? "Publish to your account" : "Sign in to publish"} />
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
              void fetch(url).then((response) => response.blob()).then(setMediaFile).catch(() => setError("Captured media could not be prepared for upload."));
            }}
            onError={setError}
          />
          {media && mediaType?.startsWith("video/") && (
            <CoverPicker videoSrc={media} onCoverChange={(c) => setCover(c?.blob ?? null)} />
          )}
          <div className="mb-2 flex items-center justify-between rounded-2xl border bg-card/80 p-2 shadow-sm">
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open Pulse Passport"
                title="Pulse Passport"
                onClick={() => void nav({ to: "/profile" })}
              >
                <ShieldCheck className="h-5 w-5 text-accent" />
              </Button>
              <div className="leading-tight">
                <p className="text-xs font-semibold">Pulse Passport</p>
                <p className="text-[11px] text-muted-foreground">Identity & sharing</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground"><Sparkles className="h-3.5 w-3.5 text-accent" /> Creator post</span>
          </div>
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
            accept="image/*,video/*" multiple
            aria-label="Upload media"
            className="sr-only"
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              const f = files[0];
              if (!f) return;
              const problem = validateUpload(f, uploadTier);
              if (problem) {
                setError(problem);
                return;
              }
              const url = URL.createObjectURL(f);
              if (f.type.startsWith("video/")) {
                const probe = document.createElement("video");
                probe.preload = "metadata";
                probe.onloadedmetadata = () => {
                  const durationProblem = validateUpload(f, uploadTier, probe.duration);
                  URL.revokeObjectURL(probe.src);
                  if (durationProblem) {
                    URL.revokeObjectURL(url);
                    setError(durationProblem);
                    return;
                  }
                  setError("");
                  setMedia(url);
                  setMediaFiles(files);
                  setMediaType(f.type);
                };
                probe.onerror = () => {
                  URL.revokeObjectURL(url);
                  setError("Video duration could not be checked. Choose another file.");
                };
                probe.src = url;
                return;
              }
              setError("");
              setMedia(url);
              setMediaFiles(files);
              setMediaType(f.type);
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {uploadTier.replaceAll("_", " ")} plan: {uploadLimits.short === Infinity ? "unlimited" : uploadLimits.short} Shorts, {uploadLimits.feed === Infinity ? "unlimited" : uploadLimits.feed} feed posts, {uploadLimits.long_form === Infinity ? "unlimited" : uploadLimits.long_form} long-form videos daily. Max file size: {uploadLimits.maxBytes >= 1024 ** 3 ? `${uploadLimits.maxBytes / 1024 ** 3} GB` : `${uploadLimits.maxBytes / 1024 ** 2} MB`}.
          </p>
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
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold"><Music2 className="mr-1 inline h-4 w-4" />Music</h2>
              <span className="text-xs text-muted-foreground">Free audio included</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={music === "none" ? "default" : "outline"} onClick={() => setMusic("none")}>Original audio</Button>
              <Button size="sm" variant={music === "pulse" ? "default" : "outline"} onClick={() => setMusic("pulse")}>Pulse free beat</Button>
              <Button size="sm" variant="outline" disabled title="Upgrade to unlock licensed music"><LockKeyhole className="h-3.5 w-3.5" /> Pro music</Button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Frame</h2>
              <span className="text-xs text-muted-foreground">Square is optimized for feed</span>
            </div>
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
          onSubmit={async (e) => {
            e.preventDefault();
            if (!caption.trim() || queued) return;
            if (!user) {
              notify("Sign in required", "Create an account before publishing to your profile.");
              void nav({ to: "/auth" });
              return;
            }
            let mediaPath: string | null = null;
            if (mediaFiles.length) {
              const uploadedPaths: string[] = [];
              for (const file of mediaFiles) {
                const extension = file.type.split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
                const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
                const { error: uploadError } = await supabase.storage.from("post-media").upload(path, file, { contentType: file.type, upsert: false });
                if (uploadError) {
                  setError("Media upload failed. Please try again.");
                  return;
                }
                const { data: publicData } = supabase.storage.from("post-media").getPublicUrl(path);
                uploadedPaths.push(publicData.publicUrl);
              }
              mediaPath = uploadedPaths.length > 1 ? JSON.stringify(uploadedPaths) : uploadedPaths[0];
            }
            const { error: publishError } = await (supabase as any).from("posts").insert({
              author_id: user.id,
              caption: caption.trim(),
              media_url: mediaPath,
              media_type: mediaType ?? null,
              audience,
              tags: tagList,
            });
            if (publishError) {
              setError("Your post could not be published. Please try again.");
              return;
            }
            const key = id || crypto.randomUUID();
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
              key,
            );
            notify("Post published", "Your post is saved to your account.");
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
              <option value="public">Public</option>
              <option value="private">Only me</option>
            </select>
          </label>
          <Button className="w-full bg-brand" disabled={!caption.trim() || queued}>
            {queued ? "Already queued" : user ? "Publish" : "Sign in to publish"}
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
Drafts remain on this device until published. Published captions, media, tags, and visibility are saved to your account.
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

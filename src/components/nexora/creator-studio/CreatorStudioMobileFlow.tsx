import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Camera,
  Check,
  ChevronDown,
  Clapperboard,
  ImagePlus,
  Plus,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StudioCapture } from "@/components/nexora/StudioCapture";
import type { MediaFrameRatio } from "@/lib/media-framing";
import type { ContentType } from "@/lib/post-types";
import TierGatedCreatorStudio from "@/components/nexora/src/components/nexora/src/components/nexora/TierGatedCreatorStudio";

type Step = "select" | "edit" | "publish";

type DraftItem = { id: string; caption: string };

type Props = {
  userPlan: "free" | "pro" | "studio";
  media?: string;
  mediaType?: string;
  frameRatio: MediaFrameRatio;
  onFrameRatioChange: (value: MediaFrameRatio) => void;
  filter: string;
  onFilterChange: (value: string) => void;
  filterIntensity: number;
  onFilterIntensityChange: (value: number) => void;
  previewFilter: string;
  contentType: ContentType;
  onContentTypeChange: (value: ContentType) => void;
  drafts: DraftItem[];
  onRestoreDraft: (id: string) => void;
  onCapture: (url: string, type: string) => void;
  onCaptureError: (message: string) => void;
  onUploadFiles: (files: File[]) => void;
  accept: string;
  onNewComposition: () => void;
  onRemoveMedia: () => void;
  caption: string;
  onCaptionChange: (value: string) => void;
  tags: string;
  onTagsChange: (value: string) => void;
  audience: "public" | "private";
  onAudienceChange: (value: "public" | "private") => void;
  uploadLimits: string;
  error: string;
  note: string;
  uploadProgress: number | null;
  uploadStatus: string;
  publishDisabled: boolean;
  saveDraftDisabled: boolean;
  onPublish: () => void;
  onSaveDraft: () => void;
  onCancel: () => void;
  advancedEditor?: ReactNode;
};

const FRAME_OPTIONS: { value: MediaFrameRatio; label: string }[] = [
  { value: "1:1", label: "Square" },
  { value: "4:5", label: "Portrait" },
  { value: "16:9", label: "Landscape" },
];

const CONTENT_OPTIONS: { value: ContentType; label: string }[] = [
  { value: "post", label: "Post" },
  { value: "reel", label: "Reel" },
  { value: "story", label: "Story" },
  { value: "carousel", label: "Carousel" },
  { value: "video", label: "Video" },
  { value: "collab", label: "Collab" },
  { value: "ad", label: "Ad" },
];

export default function CreatorStudioMobileFlow(props: Props) {
  const [step, setStep] = useState<Step>("select");
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cameraRequest, setCameraRequest] = useState(0);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const [previewZoom, setPreviewZoom] = useState(1);

  useEffect(() => {
    setPreviewZoom(1);
    pinchStart.current = null;
  }, [props.media]);

  const touchDistance = (touches: TouchList) => {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  };

  const handlePreviewTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 2) {
      pinchStart.current = { distance: touchDistance(event.touches), zoom: previewZoom };
    }
  };

  const handlePreviewTouchMove = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length !== 2 || !pinchStart.current) return;
    event.preventDefault();
    const nextZoom = pinchStart.current.zoom * (touchDistance(event.touches) / pinchStart.current.distance);
    setPreviewZoom(Math.min(3, Math.max(0.5, nextZoom)));
  };

  const handlePreviewTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length < 2) pinchStart.current = null;
  };

  const moveNext = () => {
    if (step === "select") setStep("edit");
    else if (step === "edit") setStep("publish");
    else props.onPublish();
  };

  const moveBack = () => {
    if (step === "publish") setStep("edit");
    else if (step === "edit") setStep("select");
    else props.onCancel();
  };

  return (
    <div className="fixed inset-0 z-40 flex h-[100dvh] flex-col overflow-hidden bg-background text-foreground lg:hidden">
      <header className="flex h-14 shrink-0 items-center justify-between border-b bg-background/95 px-3 pt-[env(safe-area-inset-top)] backdrop-blur">
        <Button type="button" variant="ghost" size="sm" className="px-2" onClick={moveBack}>
          {step === "select" ? <X className="mr-1 h-4 w-4" /> : <ArrowLeft className="mr-1 h-4 w-4" />}
          {step === "select" ? "Cancel" : "Back"}
        </Button>
        <div className="text-center leading-tight">
          <p className="text-sm font-semibold">Creator Studio</p>
          <p className="text-[10px] capitalize text-muted-foreground">{step} · NEXORA</p>
        </div>
        <Button
          type="button"
          size="sm"
          className="min-w-[76px]"
          disabled={step !== "publish" && step === "select" && !props.media}
          onClick={moveNext}
        >
          {step === "publish" ? "Publish" : "Next"}
        </Button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {step === "select" && (
          <section className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="relative flex min-h-[190px] max-h-[42dvh] min-w-0 flex-[0.9] items-center justify-center overflow-hidden rounded-2xl border bg-neutral-950">
              {props.media ? (
                props.mediaType?.startsWith("video/") ? (
                  <video src={props.media} controls playsInline className="h-full w-full object-contain" />
                ) : (
                  <img src={props.media} alt="Selected media preview" className="h-full w-full object-contain" />
                )
              ) : (
                <div className="text-center text-sm text-white/70"><Camera className="mx-auto mb-2 h-8 w-8" />Tap Camera to capture a moment</div>
              )}
              <div className="absolute inset-x-3 bottom-3">
                <StudioCapture onCapture={props.onCapture} onError={props.onCaptureError} openRequest={cameraRequest} hiddenWhenIdle />
              </div>
              {props.media && (
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 rounded-full"
                  aria-label="Remove selected media"
                  onClick={props.onRemoveMedia}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid shrink-0 grid-cols-3 gap-2">
              <Button type="button" variant="outline" className="h-14 flex-col gap-1" onClick={() => setCameraRequest((request) => request + 1)}>
                <Camera className="h-5 w-5" />
                <span className="text-xs">Camera</span>
              </Button>
              <Button type="button" variant="outline" className="h-14 flex-col gap-1" onClick={() => fileInput.current?.click()}>
                <Upload className="h-5 w-5" />
                <span className="text-xs">Upload</span>
              </Button>
              <Button type="button" variant="outline" className="h-14 flex-col gap-1" onClick={props.onNewComposition}>
                <Plus className="h-5 w-5" />
                <span className="text-xs">New composition</span>
              </Button>
            </div>

            {props.error && <p role="alert" className="text-xs text-destructive">{props.error}</p>}
            {props.note && !props.error && <p className="text-xs text-muted-foreground">{props.note}</p>}

            <input
              ref={fileInput}
              type="file"
              accept={props.accept}
              multiple
              className="sr-only"
              aria-label="Choose photos or videos"
              onChange={(event) => {
                const files = Array.from(event.target.files ?? []);
                event.target.value = "";
                if (files.length) props.onUploadFiles(files);
              }}
            />

            <div className="min-h-0 shrink-0">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-semibold">Recent media & drafts</p>
                <span className="text-xs text-muted-foreground">{props.drafts.length} saved</span>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {props.drafts.slice(0, 8).map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => props.onRestoreDraft(draft.id)}
                    className="min-w-0 max-w-36 shrink-0 rounded-xl border bg-card px-3 py-2 text-left"
                  >
                    <span className="block truncate text-xs font-medium">{draft.caption || "Untitled draft"}</span>
                    <span className="text-[10px] text-muted-foreground">Resume draft</span>
                  </button>
                ))}
                {!props.drafts.length && (
                  <p className="text-xs text-muted-foreground">Your saved drafts will appear here.</p>
                )}
              </div>
            </div>
          </section>
        )}

        {step === "edit" && (
          <section className="flex min-h-0 flex-1 flex-col">
            <div
              className="relative flex min-h-0 flex-[52] touch-none items-center justify-center overflow-hidden bg-neutral-950 p-3"
              onTouchStart={handlePreviewTouchStart}
              onTouchMove={handlePreviewTouchMove}
              onTouchEnd={handlePreviewTouchEnd}
              onTouchCancel={() => { pinchStart.current = null; }}
            >
              {props.media ? (
                props.mediaType?.startsWith("video/") ? (
                  <video src={props.media} controls playsInline className="max-h-full max-w-full rounded-xl object-cover" style={{ aspectRatio: props.frameRatio === "4:5" ? "4 / 5" : props.frameRatio === "16:9" ? "16 / 9" : props.frameRatio === "9:16" ? "9 / 16" : "1 / 1", height: "100%", width: "auto", maxHeight: "100%", maxWidth: "100%", filter: props.previewFilter, transform: `scale(${previewZoom})`, transition: "transform 80ms ease-out" }} />
                ) : (
                  <img src={props.media} alt="Edit preview" className="max-h-full max-w-full rounded-xl object-cover" style={{ aspectRatio: props.frameRatio === "4:5" ? "4 / 5" : props.frameRatio === "16:9" ? "16 / 9" : props.frameRatio === "9:16" ? "9 / 16" : "1 / 1", maxHeight: "100%", maxWidth: "100%", filter: props.previewFilter, transform: `scale(${previewZoom})`, transition: "transform 80ms ease-out" }} />
                )
              ) : (
                <div className="text-center text-sm text-white/70">
                  <ImagePlus className="mx-auto mb-2 h-8 w-8" />
                  Select media to start editing
                </div>
              )}
              <div className="absolute bottom-2 left-1/2 z-10 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 rounded-full bg-black/65 px-3 py-1.5 text-[10px] text-white shadow-lg">
                <span className="whitespace-nowrap">Pinch with two fingers to zoom in or out</span>
                {Math.abs(previewZoom - 1) > 0.01 && (
                  <button type="button" className="shrink-0 font-semibold underline underline-offset-2" onClick={() => setPreviewZoom(1)}>
                    Reset {Math.round(previewZoom * 100)}%
                  </button>
                )}
              </div>
              <div className="absolute left-3 right-3 top-3 flex justify-between gap-2">
                {FRAME_OPTIONS.map((frame) => (
                  <Button
                    key={frame.value}
                    type="button"
                    size="sm"
                    variant={props.frameRatio === frame.value || (props.frameRatio === "original" && frame.value === "1:1") ? "default" : "secondary"}
                    className="rounded-full shadow-lg"
                    onClick={() => props.onFrameRatioChange(frame.value)}
                  >
                    {frame.label}
                    {props.frameRatio === frame.value && <Check className="ml-1 h-3 w-3" />}
                  </Button>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-[48] flex-col overflow-hidden border-t bg-background">
              <TierGatedCreatorStudio
                userPlan={props.userPlan}
                selectedFilter={props.filter}
                onFilterChange={props.onFilterChange}
                filterIntensity={props.filterIntensity}
                onFilterIntensityChange={props.onFilterIntensityChange}
                onNavigateToSubscriptions={() => void navigate({ to: "/subscriptions" })}
                advancedEditor={props.advancedEditor}
              />
            </div>
          </section>
        )}

        {step === "publish" && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 pb-5">
              <div className="flex items-start gap-3">
                <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-neutral-950">
                  {props.media ? (
                    props.mediaType?.startsWith("video/") ? (
                      <video src={props.media} muted playsInline className="h-full w-full object-cover" />
                    ) : (
                      <img src={props.media} alt="Post thumbnail" className="h-full w-full object-cover" />
                    )
                  ) : (
                    <ImagePlus className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <label className="min-w-0 flex-1 space-y-2 text-sm font-medium">
                  Caption
                  <textarea
                    value={props.caption}
                    onChange={(event) => props.onCaptionChange(event.target.value)}
                    rows={4}
                    placeholder="What's the scene?"
                    className="w-full resize-none rounded-xl border bg-card p-3 text-sm font-normal outline-none focus:ring-2 focus:ring-primary"
                  />
                </label>
              </div>

              <button type="button" onClick={() => setLimitsOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl border bg-card px-3 py-3 text-left">
                <span className="flex items-center gap-2 text-sm font-medium"><Clapperboard className="h-4 w-4" /> Plan limits</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${limitsOpen ? "rotate-180" : ""}`} />
              </button>
              {limitsOpen && <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{props.uploadLimits}</p>}

              <button type="button" onClick={() => setSettingsOpen((open) => !open)} className="flex w-full items-center justify-between rounded-xl border bg-card px-3 py-3 text-left">
                <span className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-4 w-4" /> Advanced settings</span>
                <ChevronDown className={`h-4 w-4 transition-transform ${settingsOpen ? "rotate-180" : ""}`} />
              </button>
              {settingsOpen && (
                <div className="space-y-3 rounded-xl border bg-card p-3">
                  <label className="block space-y-1 text-xs font-medium">
                    Tags
                    <input value={props.tags} onChange={(event) => props.onTagsChange(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal" />
                  </label>
                  <label className="block space-y-1 text-xs font-medium">
                    Audience
                    <select value={props.audience} onChange={(event) => props.onAudienceChange(event.target.value === "private" ? "private" : "public")} className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal">
                      <option value="public">Public</option>
                      <option value="private">Only me</option>
                    </select>
                  </label>
                  <label className="block space-y-1 text-xs font-medium">
                    Content type
                    <select value={props.contentType} onChange={(event) => props.onContentTypeChange(event.target.value as ContentType)} className="w-full rounded-lg border bg-background px-3 py-2 text-sm font-normal">
                      {CONTENT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  </label>
                </div>
              )}

              {props.error && <p role="alert" className="text-sm text-destructive">{props.error}</p>}
              {props.note && !props.error && <p className="text-xs text-muted-foreground">{props.note}</p>}
              {props.uploadProgress !== null && (
                <div className="space-y-2 rounded-xl border bg-card p-3" role="status" aria-live="polite">
                  <div className="flex justify-between gap-2 text-xs"><span>{props.uploadStatus || "Uploading media…"}</span><span className="font-semibold tabular-nums">{props.uploadProgress}%</span></div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${props.uploadProgress}%` }} /></div>
                </div>
              )}
            </div>

            <footer className="shrink-0 border-t bg-background/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="shrink-0" disabled={props.saveDraftDisabled} onClick={props.onSaveDraft}>Save draft</Button>
                <Button type="button" className="flex-1" disabled={props.publishDisabled} onClick={props.onPublish}>Publish to Nexora</Button>
              </div>
            </footer>
          </section>
        )}
      </div>
    </div>
  );
}

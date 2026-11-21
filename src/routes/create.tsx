import TierGatedCreatorStudio from "@/components/nexora/src/components/nexora/src/components/nexora/TierGatedCreatorStudio";
import AdvancedVideoStudioEditor from "@/components/nexora/AdvancedVideoStudioEditor";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Upload, Save, Trash2, Image, Film, FileText, ShieldCheck, Sparkles, Music2, LockKeyhole } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/lib/session";
import { useApp } from "@/features/core/store";
import { useWorkspace } from "@/features/core/workspace";

import { PageHeader } from "@/components/nexora/ui";
import { StudioCapture } from "@/components/nexora/StudioCapture";
import { CoverPicker } from "@/components/nexora/src/components/nexora/src/components/nexora/CoverPicker";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { accountTierFromUser, UPLOAD_POLICY } from "@/lib/upload-policy";
import { ContentTypePicker } from "@/components/nexora/ContentTypePicker";
import { CONTENT_TYPES, kindFor, pickMedia, typeTag, type ContentType, type UploadClassification } from "@/lib/post-types";
import { cleanupR2MediaObjects, createR2MediaUploadUrl, verifyR2MediaUpload } from "@/lib/r2-media.functions";
import { uploadFileWithProgress } from "@/lib/media-upload";
import { MediaFramingEditor } from "@/components/nexora/MediaFramingEditor";
import { createMediaPoster } from "@/lib/media-poster";
import { getFreshR2MediaPlaybackUrl } from "@/lib/r2-media-playback";
import { getMediaAspectRatioValue, normalizeMediaFraming, type MediaFrameRatio } from "@/lib/media-framing";

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
  const { drafts, saveDraft, removeDraft, notify, preferences, replaceDrafts } = useWorkspace();
  const nav = useNavigate();
  const [id, setId] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("creators");
  const [audience, setAudience] = useState<"public" | "private">(
    preferences.privateProfile ? "private" : "public",
  );
  const [media, setMedia] = useState<string>();
  const [originalMedia, setOriginalMedia] = useState<string>();
  const [mediaFiles, setMediaFiles] = useState<Blob[]>([]);
  const [mediaType, setMediaType] = useState<string>();
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [filter, setFilter] = useState("original");
  const [filterIntensity, setFilterIntensity] = useState(80);
  const [format, setFormat] = useState("square");
  const [frameRatio, setFrameRatio] = useState<MediaFrameRatio>("original");
  const [focalX, setFocalX] = useState(50);
  const [focalY, setFocalY] = useState(50);
  const [zoom, setZoom] = useState(1);
  const [dominantColor, setDominantColor] = useState("#171717");
  const [cover, setCover] = useState<Blob | null>(null);
  const [contentType, setContentType] = useState<ContentType>("post");
  const [mediaClassification, setMediaClassification] = useState<UploadClassification>({ contentType: "post", aspectRatio: null, durationSeconds: null });
  const [note, setNote] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const accept = CONTENT_TYPES.find((c) => c.id === contentType)?.accept || "image/*,video/*";
  const input = useRef<HTMLInputElement>(null);
  const uploadTier = accountTierFromUser(user);
  const appMetadata = user?.app_metadata ?? {};
  const rawPlan = String(
    appMetadata.subscription_tier ?? appMetadata.plan ?? "free"
  ).toLowerCase();
  const planExpiresAt = Date.parse(String(appMetadata.subscription_expires_at ?? ""));
  const hasActivePaidPlan =
    (rawPlan === "pro" || rawPlan === "studio") &&
    Number.isFinite(planExpiresAt) &&
    planExpiresAt > Date.now();

  const userPlan = hasActivePaidPlan ? rawPlan : "free";
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
    mediaPaths: drafts.find((item) => item.id === key)?.mediaPaths,
    contentType,
  });
  useEffect(() => {
    let active = true;
    if (!user?.id) {
      replaceDrafts([]);
      return () => {
        active = false;
      };
    }
    void (async () => {
      const { data, error: loadError } = await (supabase as any)
        .from("creator_drafts")
        .select("id, caption, media_paths, media_type, content_type, tags, audience, filter, format")
        .order("updated_at", { ascending: false });
      if (!active) return;
      if (loadError) {
        setError("Your saved drafts could not be loaded. Please refresh and try again.");
        return;
      }
      replaceDrafts(
        (data ?? []).map((row: any) => ({
          id: row.id,
          caption: row.caption ?? "",
          mediaType: row.media_type ?? undefined,
          mediaPaths: Array.isArray(row.media_paths) ? row.media_paths : [],
          contentType: row.content_type ?? "post",
          tags: Array.isArray(row.tags) ? row.tags : [],
          audience: row.audience === "private" ? "private" : "public",
          filter: row.filter ?? "original",
          format: row.format ?? "square",
        })),
      );
    })();
    return () => {
      active = false;
    };
  }, [user?.id, replaceDrafts]);

  const queued = relay.some(
    (item) => item.kind === "post" && (item.payload as { draftId?: string }).draftId === id,
  );
  const reset = () => {
    setId("");
    setCaption("");
    setTags("creators");
    setMedia(undefined);
    setOriginalMedia(undefined);
    setMediaFiles([]);
    setMediaType(undefined);
    setCover(null);
    setContentType("post");
    setMediaClassification({ contentType: "post", aspectRatio: null, durationSeconds: null });
    setFilter("original");
    setFormat("landscape");
    setFrameRatio("original");
    setFocalX(50);
    setFocalY(50);
    setZoom(1);
    setDominantColor("#171717");
    setError("");
  };
  const intensity = filterIntensity / 100;

const previewFilter =
  filter === "original" ? "none" :
  filter === "vivid" ? `saturate(${0.5 + intensity * 1.5})` :
  filter === "mono" ? `grayscale(${intensity})` :
  filter === "cinema" ? `contrast(${0.9 + intensity * 0.4}) saturate(${0.8 + intensity * 0.4})` :
  `brightness(${0.9 + intensity * 0.15}) saturate(${0.85 + intensity * 0.3})`;
  return (
    <div className="space-y-6">
      <PageHeader title="Creator Studio Plus" subtitle={user ? "Publish to your account" : "Sign in to publish"} />
      <ContentTypePicker
        value={contentType}
        onSelect={(t) => (t === "live" ? void nav({ to: "/live" }) : setContentType(t))}
      />
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
                    setNote("This browser cannot preview this video, but it will still upload.")
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
  setOriginalMedia(url);
  setMediaType(type);
  setError("");
  void fetch(url)
    .then((response) => response.blob())
    .then((blob) => {
      const extension = type.startsWith("video/") ? "webm" : "jpg";
      const file = new File([blob], `capture.${extension}`, { type });
      pickMedia([file], {
        contentType,
        tier: uploadTier,
        setError,
        setNote,
        accept: (previewUrl, files, mimeType, classification) => {
          setMedia(previewUrl);
          setOriginalMedia(previewUrl);
          setMediaFiles(files);
          setMediaType(mimeType);
          setMediaClassification(classification);
          setFrameRatio("original"); setFocalX(50); setFocalY(50); setZoom(1);
          if (mimeType.startsWith("video/") && contentType !== "collab") setContentType(classification.contentType);
        },
      });
    })
    .catch(() => setError("Captured media could not be prepared for upload."));
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
                  setOriginalMedia(undefined);
                  setMediaFiles([]);
                  setMediaType(undefined);
                  setCover(null);
                  setContentType("post");
                  setMediaClassification({ contentType: "post", aspectRatio: null, durationSeconds: null });
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
            accept={accept} multiple
            aria-label="Upload media"
            className="sr-only"
            onChange={(e) => {
              const picked = Array.from(e.target.files ?? []);
              e.target.value = "";
              pickMedia(picked, {
                contentType,
                tier: uploadTier,
                setError,
                setNote,
                accept: (url, files, type, classification) => {
                  setMedia(url);
                  setOriginalMedia(url);
                  setMediaFiles(files);
                  setMediaType(type);
                  setMediaClassification(classification);
                  setFrameRatio("original"); setFocalX(50); setFocalY(50); setZoom(1);
                  if (type.startsWith("video/") && contentType !== "collab") setContentType(classification.contentType);
                },
              });
            }}
          />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          {note && !error && <p className="text-sm text-muted-foreground">{note}</p>}
          <p className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs text-muted-foreground">
            {uploadTier.replaceAll("_", " ")} plan: {uploadLimits.short === Infinity ? "unlimited" : uploadLimits.short} Reels, {uploadLimits.feed === Infinity ? "unlimited" : uploadLimits.feed} feed posts, {uploadLimits.long_form === Infinity ? "unlimited" : uploadLimits.long_form} long-form videos daily. Max file size: {uploadLimits.maxBytes >= 1024 ** 3 ? `${uploadLimits.maxBytes / 1024 ** 3} GB` : `${uploadLimits.maxBytes / 1024 ** 2} MB`}.
          </p>
          
          <TierGatedCreatorStudio
            userPlan={userPlan}
            selectedFilter={filter}
            onFilterChange={setFilter}
            filterIntensity={filterIntensity}
            onFilterIntensityChange={setFilterIntensity}
            onNavigateToSubscriptions={() => void nav({ to: "/subscriptions" })}
          />
          {media && mediaType?.startsWith("video/") && (
            userPlan === "studio" ? (
              <AdvancedVideoStudioEditor
                key={originalMedia || media}
                videoSrc={originalMedia || media}
                onExported={(file) => {
                  const mimeType = file.type.split(";")[0] || "video/webm";
                  const extension = mimeType.includes("mp4") ? "mp4" : "webm";
                  const editedFile = new File([file], `edited.${extension}`, { type: mimeType });
                  pickMedia([editedFile], {
                    contentType,
                    tier: uploadTier,
                    setError,
                    setNote,
                    accept: (editedUrl, files, detectedType, classification) => {
                      setMedia(editedUrl);
                      setOriginalMedia(editedUrl);
                      setMediaFiles(files);
                      setMediaType(detectedType);
                      setMediaClassification(classification);
                      setFrameRatio("original"); setFocalX(50); setFocalY(50); setZoom(1);
                      if (contentType !== "collab") setContentType(classification.contentType);
                      setCover(null);
                      setNote("Your edited video is ready. Publishing will upload the edited copy.");
                    },
                  });
                }}
              />
            ) : (
              <section className="space-y-2 rounded-xl border border-primary/20 bg-primary/[0.03] p-4">
                <h2 className="text-sm font-semibold">Advanced video export</h2>
                <p className="text-xs text-muted-foreground">Trim, mix audio, record voiceovers and add creator branding, then export a downloadable video with the Studio plan.</p>
                <Button type="button" size="sm" className="w-full" onClick={() => void nav({ to: "/subscriptions" })}>Explore Studio plan</Button>
              </section>
            )
          )}
          {media && (
            <MediaFramingEditor
              src={media}
              mediaType={mediaType}
              originalAspectRatio={getMediaAspectRatioValue(mediaClassification.aspectRatio)}
              frameRatio={frameRatio}
              focalX={focalX}
              focalY={focalY}
              zoom={zoom}
              onFrameRatioChange={(value) => {
                setFrameRatio(value);
                setFormat(value === "9:16" ? "portrait" : value === "16:9" ? "landscape" : value === "original" ? "landscape" : "square");
              }}
              onFramingChange={(value) => {
                const next = normalizeMediaFraming(value);
                setFocalX(next.focalX); setFocalY(next.focalY); setZoom(next.zoom);
              }}
            />
          )}
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
            let thumbnailUrl: string | null = null;
            let mediaStorageProvider: "supabase" | "r2" = "supabase";
            let mediaStorageKey: string | null = null;
            let thumbnailStorageProvider: "supabase" | "r2" = "supabase";
            let thumbnailStorageKey: string | null = null;
            const pendingR2Keys: string[] = [];
            let generatedPoster: Awaited<ReturnType<typeof createMediaPoster>> | null = null;
            if (cover || mediaFiles.length === 1) {
              try {
                const posterSource = cover
                  ? new File([cover], "selected-cover", { type: cover.type || "image/jpeg" })
                  : (mediaFiles[0] as File);
                generatedPoster = await createMediaPoster(posterSource);
                if (generatedPoster) setDominantColor(generatedPoster.dominantColor);
              } catch (posterError) {
                console.warn("Automatic poster generation skipped:", posterError);
              }
            }
            const posterBlob = generatedPoster?.blob ?? cover ?? null;
            if (mediaFiles.length) {
              // Keep single-file photos and videos together with their generated poster in R2.
              // Multi-file posts and unsupported image formats retain the existing Supabase Storage path.
              const r2MediaTypes = [
                "video/mp4", "video/webm", "video/quicktime", "video/x-matroska",
                "image/jpeg", "image/png", "image/webp", "image/avif",
              ];
              const useR2 =
                mediaFiles.length === 1 &&
                r2MediaTypes.includes(mediaFiles[0].type) &&
                mediaFiles[0].size <= 5 * 1024 ** 3;
              const uploadedPaths: string[] = [];
              const totalUploadBytes = mediaFiles.reduce((total, file) => total + file.size, 0) +
                (mediaFiles.length === 1 ? posterBlob?.size ?? 0 : 0);
              let completedUploadBytes = 0;
              setUploadProgress(0);
              setUploadStatus("Preparing upload...");

              for (const file of mediaFiles) {
                if (useR2) {
                  setUploadStatus("Uploading media...");
                  try {
                    const signed = await createR2MediaUploadUrl({
                      data: { contentType: file.type as "video/mp4" | "video/webm" | "video/quicktime" | "video/x-matroska" | "image/jpeg" | "image/png" | "image/webp" | "image/avif", size: file.size },
                    });
                    pendingR2Keys.push(signed.key);
                    await uploadFileWithProgress(
                      signed.uploadUrl,
                      file,
                      signed.uploadHeaders,
                      (loaded) => setUploadProgress(Math.min(99, Math.round(((completedUploadBytes + loaded) / totalUploadBytes) * 100))),
                    );
                    completedUploadBytes += file.size;
                    const verified = await verifyR2MediaUpload({
                      data: { key: signed.key, contentType: file.type as "video/mp4" | "video/webm" | "video/quicktime" | "video/x-matroska" | "image/jpeg" | "image/png" | "image/webp" | "image/avif", size: file.size },
                    });
                    if (!verified.verified) throw new Error("R2 upload could not be verified.");

                    mediaStorageProvider = "r2";
                    mediaStorageKey = verified.key;
                    mediaPath = verified.key;

                    if (posterBlob) {
                      const posterType = posterBlob.type === "image/webp" ? "image/webp" : "image/jpeg";
                      const coverSigned = await createR2MediaUploadUrl({
                        data: { contentType: posterType, size: posterBlob.size },
                      });
                      pendingR2Keys.push(coverSigned.key);
                      setUploadStatus("Uploading media poster...");
                      await uploadFileWithProgress(
                        coverSigned.uploadUrl,
                        posterBlob,
                        coverSigned.uploadHeaders,
                        (loaded) => setUploadProgress(Math.min(99, Math.round(((completedUploadBytes + loaded) / totalUploadBytes) * 100))),
                      );
                      completedUploadBytes += posterBlob.size;
                      const coverVerified = await verifyR2MediaUpload({
                        data: { key: coverSigned.key, contentType: posterType, size: posterBlob.size },
                      });
                      if (!coverVerified.verified) throw new Error("Media poster could not be verified.");
                      thumbnailStorageProvider = "r2";
                      thumbnailStorageKey = coverVerified.key;
                    }
                    setUploadProgress(100);
                    setUploadStatus("Upload complete. Publishing your post...");
                  } catch (uploadFailure) {
                    console.error("R2 media upload failed:", uploadFailure);
                    if (pendingR2Keys.length) {
                      await cleanupR2MediaObjects({ data: { keys: pendingR2Keys } }).catch(() => undefined);
                    }
                    setUploadProgress(null);
                    setUploadStatus("");
                    setError(uploadFailure instanceof Error ? uploadFailure.message : "Video upload failed. Please try again.");
                    return;
                  }
                } else {
                  const extension = file.type.split(";")[0].split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
                  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
                  const { data: signedUpload, error: signError } = await supabase.storage
                    .from("post-media")
                    .createSignedUploadUrl(storagePath, { upsert: false });
                  if (signError || !signedUpload?.signedUrl) {
                    setUploadProgress(null);
                    setUploadStatus("");
                    setError("Could not prepare media upload. Please try again.");
                    return;
                  }
                  setUploadStatus("Uploading media...");
                  try {
                    await uploadFileWithProgress(
                      signedUpload.signedUrl,
                      file,
                      { "Content-Type": file.type },
                      (loaded) => setUploadProgress(Math.min(99, Math.round(((completedUploadBytes + loaded) / totalUploadBytes) * 100))),
                    );
                  } catch (uploadFailure) {
                    setUploadProgress(null);
                    setUploadStatus("");
                    setError(uploadFailure instanceof Error ? uploadFailure.message : "Media upload failed. Please try again.");
                    return;
                  }
                  completedUploadBytes += file.size;
                  const { data: publicData } = supabase.storage.from("post-media").getPublicUrl(storagePath);
                  uploadedPaths.push(publicData.publicUrl);
                  if (posterBlob && mediaFiles.length === 1) {
                    const posterExtension = posterBlob.type === "image/webp" ? "webp" : "jpg";
                    const coverPath = storagePath.replace(/\.[^./]+$/, "-poster." + posterExtension);
                    const { data: signedCover, error: signCoverError } = await supabase.storage
                      .from("post-media")
                      .createSignedUploadUrl(coverPath, { upsert: false });
                    if (signCoverError || !signedCover?.signedUrl) {
                      setUploadProgress(null);
                      setUploadStatus("");
                      setError("Could not prepare video cover upload. Please try again.");
                      return;
                    }
                    setUploadStatus("Uploading video cover...");
                    try {
                      await uploadFileWithProgress(
                        signedCover.signedUrl,
                        posterBlob,
                        { "Content-Type": posterBlob.type === "image/webp" ? "image/webp" : "image/jpeg" },
                        (loaded) => setUploadProgress(Math.min(99, Math.round(((completedUploadBytes + loaded) / totalUploadBytes) * 100))),
                      );
                    } catch (coverFailure) {
                      setUploadProgress(null);
                      setUploadStatus("");
                      setError(coverFailure instanceof Error ? coverFailure.message : "Video cover upload failed. Please try again.");
                      return;
                    }
                    completedUploadBytes += posterBlob.size;
                    thumbnailStorageProvider = "supabase";
                    thumbnailStorageKey = coverPath;
                    thumbnailUrl = supabase.storage.from("post-media").getPublicUrl(coverPath).data.publicUrl;
                  }
                }
              }
              if (!useR2) mediaPath = uploadedPaths.length > 1 ? JSON.stringify(uploadedPaths) : uploadedPaths[0];
              setUploadProgress(100);
              setUploadStatus("Upload complete. Publishing your post...");
            }
                        const typedTags = [...tagList, typeTag(contentType)];
            const strictContentType = contentType === "collab" || tagList.some((tag) => tag.toLowerCase() === "collab")
              ? "collab"
              : mediaClassification.contentType;
            const { data: savedPost, error: publishError } = await (supabase as any)
              .from("user_media_posts")
              .insert({
                user_id: user.id,
                caption: caption.trim(),
                media_url: mediaPath,
                media_type: mediaType ?? null,
                thumbnail_url: thumbnailUrl,
                media_storage_provider: mediaStorageProvider,
                media_storage_key: mediaStorageKey,
                thumbnail_storage_provider: thumbnailStorageProvider,
                thumbnail_storage_key: thumbnailStorageKey,
                content_type: strictContentType,
                aspect_ratio: mediaClassification.aspectRatio,
                framing_aspect_ratio: frameRatio,
                focal_x: normalizeMediaFraming({ focalX, focalY, zoom }).focalX,
                focal_y: normalizeMediaFraming({ focalX, focalY, zoom }).focalY,
                zoom: normalizeMediaFraming({ focalX, focalY, zoom }).zoom,
                dominant_color: generatedPoster?.dominantColor ?? dominantColor,
                duration_seconds: mediaClassification.durationSeconds,
                audience,
                tags: typedTags,
              })
              .select("id")
              .single();

            if (publishError || !savedPost?.id) {
              setUploadProgress(null);
              setUploadStatus("");
              if (pendingR2Keys.length) {
                await cleanupR2MediaObjects({ data: { keys: pendingR2Keys } }).catch((cleanupError) =>
                  console.error("Could not clean up unlinked R2 media:", cleanupError),
                );
              }
              console.error("Post publishing failed:", publishError);
              setError(
  publishError?.message ?? "Post was not saved: no post ID returned.",
);
              return;
            }

            const key = id || crypto.randomUUID();
            let displayMediaUrl = mediaStorageProvider === "r2" ? media : mediaPath ?? undefined;
            let displayThumbnailUrl = thumbnailUrl ?? undefined;
            if (mediaStorageProvider === "r2") {
              try {
                const [freshMediaUrl, freshThumbnailUrl] = await Promise.all([
                  getFreshR2MediaPlaybackUrl(savedPost.id, "media"),
                  thumbnailStorageProvider === "r2"
                    ? getFreshR2MediaPlaybackUrl(savedPost.id, "thumbnail")
                    : Promise.resolve(undefined),
                ]);
                displayMediaUrl = freshMediaUrl ?? displayMediaUrl;
                displayThumbnailUrl = freshThumbnailUrl ?? displayThumbnailUrl;
              } catch (playbackError) {
                console.warn("Fresh R2 playback URLs could not be prepared:", playbackError);
              }
            }

            createPost(
              {
                caption: caption.trim(),
                image: displayMediaUrl,
                mediaType,
                mediaPostId: savedPost.id,
                mediaStorageProvider,
                audience,
                filter,
                format,
                aspectRatio: mediaClassification.aspectRatio,
                frameRatio,
                focalX,
                focalY,
                zoom,
                dominantColor: generatedPoster?.dominantColor ?? dominantColor,
                thumbnailUrl: displayThumbnailUrl,
                kind: kindFor(contentType, !!mediaType?.startsWith("video/")),
                tags: typedTags,
              },
              key,
              savedPost.id,
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
          {uploadProgress !== null && (
            <div className="space-y-2 rounded-xl border bg-card p-3" role="status" aria-live="polite">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-medium">{uploadStatus || "Uploading media..."}</span>
                <span className="font-semibold tabular-nums">{uploadProgress}%</span>
              </div>
              <div
                className="h-2 w-full overflow-hidden rounded-full bg-muted"
                role="progressbar"
                aria-label="Media upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-150" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}
          <Button className="w-full bg-brand" disabled={!caption.trim() || queued || uploadProgress !== null}>
            {queued ? "Already queued" : user ? "Publish" : "Sign in to publish"}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={(!caption.trim() && !media) || queued || savingDraft}
            onClick={async () => {
              if (!user?.id) {
                notify("Sign in required", "Sign in to save drafts to your account.");
                void nav({ to: "/auth" });
                return;
              }
              const key = id || crypto.randomUUID();
              const existing = drafts.find((item) => item.id === key);
              let mediaPaths = media ? existing?.mediaPaths ?? [] : [];
              const uploadedPaths: string[] = [];
              setSavingDraft(true);
              setError("");
              try {
                for (const file of mediaFiles) {
                  const extension = file.type.split(";")[0].split("/")[1]?.replace(/[^a-z0-9]/gi, "") || "bin";
                  const uploadedPath = `${user.id}/${key}/${crypto.randomUUID()}.${extension}`;
                  const { error: uploadError } = await supabase.storage
                    .from("creator-drafts")
                    .upload(uploadedPath, file, { contentType: file.type, upsert: false });
                  if (uploadError) throw uploadError;
                  uploadedPaths.push(uploadedPath);
                }
                if (uploadedPaths.length) mediaPaths = uploadedPaths;
                const draftData = {
                  id: key,
                  user_id: user.id,
                  caption: caption.trim(),
                  media_paths: mediaPaths,
                  media_type: mediaType ?? null,
                  content_type: contentType,
                  tags: tagList,
                  audience,
                  filter,
                  format,
                  updated_at: new Date().toISOString(),
                };
                const { error: saveError } = await (supabase as any)
                  .from("creator_drafts")
                  .upsert(draftData, { onConflict: "id" });
                if (saveError) throw saveError;
                const oldPaths = (existing?.mediaPaths ?? []).filter((path) => !mediaPaths.includes(path));
                if (oldPaths.length) {
                  await supabase.storage.from("creator-drafts").remove(oldPaths);
                }
                setId(key);
                saveDraft({ ...draft(key), mediaPaths, contentType });
                setNote("Draft saved securely to your account.");
              } catch (saveError) {
                if (uploadedPaths.length) {
                  await supabase.storage.from("creator-drafts").remove(uploadedPaths);
                }
                console.error("Draft save failed:", saveError);
                setError("Draft could not be saved. Please check your connection and try again.");
              } finally {
                setSavingDraft(false);
              }
            }}
          >
            <Save />
            {savingDraft ? "Saving…" : "Save draft"}
          </Button>
          <p className="text-xs text-muted-foreground">
Draft captions, media, tags and audience are saved privately to your account.
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
                onClick={async () => {
                  setId(d.id);
                  setCaption(d.caption);
                  setTags(d.tags.join(", "));
                  setMedia(undefined);
                  setOriginalMedia(undefined);
                  setMediaFiles([]);
                  setMediaType(d.mediaType);
                  setContentType((d.contentType as ContentType) || "post");
                  setAudience(d.audience);
                  setFilter(d.filter || "original");
                  setFormat(d.format || "landscape");
                  setError("");
                  if (d.mediaPaths?.length) {
                    const downloads = await Promise.all(
                      d.mediaPaths.map((path) => supabase.storage.from("creator-drafts").download(path)),
                    );
                    if (downloads.some(({ data, error }) => error || !data)) {
                      setError("Some media in this draft could not be restored. Please try again.");
                      return;
                    }
                    const files = downloads.map(({ data }) => data as Blob);
                    const urls = files.map((file) => URL.createObjectURL(file));
                    setMedia(urls[0]);
                    setOriginalMedia(urls[0]);
                    setMediaFiles(files);
                  }
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
                onClick={async () => {
                  const { error: deleteError } = await (supabase as any)
                    .from("creator_drafts")
                    .delete()
                    .eq("id", d.id);
                  if (deleteError) {
                    setError("Draft could not be deleted. Please try again.");
                    return;
                  }
                  if (d.mediaPaths?.length) {
                    await supabase.storage.from("creator-drafts").remove(d.mediaPaths);
                  }
                  removeDraft(d.id);
                  if (id === d.id) reset();
                }}
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

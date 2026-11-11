import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type Cover = { blob: Blob; previewUrl: string };

type Props = {
  /** Object URL of the selected video. */
  videoSrc: string;
  /** Called with the chosen cover, or null when it is cleared. */
  onCoverChange: (cover: Cover | null) => void;
};

/** Lets a creator pick a cover by scrubbing to a video frame or uploading an image. */
export function CoverPicker({ videoSrc, onCoverChange }: Props) {
  const [mode, setMode] = useState<"frame" | "custom">("frame");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const lastUrl = useRef<string | null>(null);

  function setCover(blob: Blob | null) {
    if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    if (!blob) {
      lastUrl.current = null;
      setPreview(null);
      onCoverChange(null);
      return;
    }
    const previewUrl = URL.createObjectURL(blob);
    lastUrl.current = previewUrl;
    setPreview(previewUrl);
    onCoverChange({ blob, previewUrl });
  }

  // New video: clear the old cover and reset the scrubber.
  useEffect(() => {
    setTime(0);
    setDuration(0);
    setError("");
    setCover(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoSrc]);

  useEffect(() => () => { if (lastUrl.current) URL.revokeObjectURL(lastUrl.current); }, []);

  function captureFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => (blob ? setCover(blob) : setError("Could not capture this frame.")),
      "image/jpeg",
      0.9,
    );
  }

  function seek(value: number) {
    setTime(value);
    if (videoRef.current) videoRef.current.currentTime = value;
  }

  function onCustomFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file.");
    if (file.size > 5 * 1024 * 1024) return setError("Cover image must be under 5 MB.");
    setError("");
    setCover(file);
  }

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Cover</h3>
        {preview && (
          <span className="flex items-center gap-1 text-xs text-emerald-400">
            <CheckCircle2 className="h-4 w-4" /> Cover set
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["frame", "custom"] as const).map((m) => (
          <Button key={m} type="button" size="sm" variant={mode === m ? "default" : "outline"} onClick={() => setMode(m)}>
            {m === "frame" ? "Pick a frame" : "Upload image"}
          </Button>
        ))}
      </div>

      {mode === "frame" ? (
        <div className="space-y-2">
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            preload="metadata"
            onLoadedMetadata={() => setDuration(videoRef.current?.duration ?? 0)}
            onSeeked={captureFrame}
            className="max-h-64 w-full rounded-xl bg-black object-contain"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Drag to choose a frame</span>
            <span>{time.toFixed(1)}s / {duration.toFixed(1)}s</span>
          </div>
          <input
            type="range"
            aria-label="Choose cover frame"
            min={0}
            max={duration || 1}
            step={0.1}
            value={time}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex w-full flex-col items-center gap-1 rounded-xl border border-dashed p-6 text-sm text-muted-foreground"
        >
          <ImageIcon className="h-6 w-6" />
          Choose a cover image (JPG or PNG)
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => onCustomFile(e.target.files?.[0])} />
        </button>
      )}

      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}

      {preview && (
        <div className="flex items-center gap-3 border-t pt-3">
          <img src={preview} alt="Selected cover" className={cn("h-24 w-16 rounded-lg border object-cover")} />
          <Button type="button" size="sm" variant="outline" onClick={() => setCover(null)}>Remove cover</Button>
        </div>
      )}
    </div>
  );
}
